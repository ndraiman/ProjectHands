var mongoUtils = require('./mongo');
var debug = require('debug')('utils/auth');
var config = require('../../config.json');
var COLLECTIONS = config.COLLECTIONS;
var ROLES = config.ROLES;
var HttpStatus = require('http-status-codes');
var ROLES_HIERARCHY = Object.keys(ROLES).map(function (key) {
    return ROLES[key];
}).reverse();
var bcrypt = require('bcrypt');
var saltRounds = 10; // will do 2^rounds

var validate = require('./validation');


/** CONSTANTS */
var MESSAGES = {
    DB_FETCH_ERROR: "Error has accourd , please  try again",
    PASSWORD_NOT_MATCH_ERROR: "The password dose not match , please try again",
    PASSWORD_UPDATING_ERROR: "Error has accourd while updating the password",
    PASSWORD_UPDATE_SUCCESS: "The password has been changed",
    USER_DATA_NOT_EXIST: "Wrong Email or Phone number"
};

/**
 *Generates a hash for the given data
 *
 * @param password {string}: the data to be hased
 * @param callback {function(error,result) } : will be executed when finish
 */
function doPasswordHash(password, callback) {
    bcrypt.hash(password, saltRounds, function (error, hash) {

        debug('bcrypt hash error', error);
        debug('bcrypt hash hash', hash);
        callback(error, hash);
    });
}
module.exports = {

    /**
     * The roles passed to export
     * @link ROLES : contains the Roles in the system
     */
    roles: ROLES,
    messages: MESSAGES,

    /**
     * @param user {object}
     * @param newRole {string}
     * @param callback {function}
     */
    setUserRole: function (user, newRole, callback) {
        //we need to check that who sent the request has admin role
        mongoUtils.update(COLLECTIONS.USERS, {email: user.email}, {$set: {role: newRole}}, {}, callback);
    },

    /**
     * Insert a user to the DataBase
     * @param user {object} : the user details from the Client
     * @param callback {function} : methods will be executed when the user is inserted(Success/Fail)
     */
    signUp: function (user, callback) {

        if (!validate.email(user.email))
            return callback({errMessage: "Invalid Email"}, null);
        if (!validate.password(user.password))
            return callback({errMessage: "Invalid Password"}, null);
        if (!validate.id(user.realID))
            return callback({errMessage: "Invalid ID"}, null);

        //Set TTL on collection's documents with field "createdAt"
        mongoUtils.getCollection(COLLECTIONS.SIGNUPS).ensureIndex({createdAt: 1},
            {expireAfterSeconds: 86400}, // 24 hours
            function (error, indexName) {
                debug('ensureIndex indexName', indexName);
                debug('ensureIndex error', error);
            });


        //Check if user already exists
        mongoUtils.query(COLLECTIONS.USERS, {email: user.email}, function (error, result) {
            if (result && result.length)
                return callback({errMessage: "Account Already Exists"}, null);

            //Check if user already signed up
            mongoUtils.query(COLLECTIONS.SIGNUPS, {email: user.email}, function (error, result) {
                if (result && result.length)
                    return callback({errMessage: "Account Already Signed up"}, null);


                user.createdAt = new Date();
                doPasswordHash(user.password, function (error, hashedPassword) {
                    if (error || !hashedPassword) {
                        return callback({errMessage: "Failed to hash password"}, null);

                    }
                    user.password = hashedPassword;
                    user.approved = false;
                    mongoUtils.insert(COLLECTIONS.SIGNUPS, user, callback);

                });
            });

        });
    },


    oauthSignup: function (user, info, callback) {

        info.signup_complete = true;
        mongoUtils.update(COLLECTIONS.USERS, {email: user.email}, {$set: info}, {}, callback)
    },

    /**
     * Activate a temporary user account
     * @param user {object} : Object with the user details
     * @param callback {function} : Function to be executed on completion
     */
    activateAccount: function (user, callback) {
        mongoUtils.delete(COLLECTIONS.SIGNUPS, user, function (error, result) {
            if (error)
                debug('Failed to delete user from signups');
            else
                debug('deleted user from signups');
        });

        mongoUtils.insert(COLLECTIONS.USERS, user, callback);
    },

    /**
     * checks whether to send an email reset link or not
     * @param email {string} : the user email
     * @param phone {string} : the user phone
     * @param callback
     */
    passwordResetRequest: function (email, callback) {

        // validate the data
        mongoUtils.query(COLLECTIONS.USERS, {email: email}, function (error, result) {
            if (error) {
                callback(error, MESSAGES.DB_FETCH_ERROR);
            }
            else {
                if (result.length === 0) {
                    callback(error, MESSAGES.USER_DATA_NOT_EXIST);
                }
                else {
                    callback(error, result[0].name);
                }
            }

        });
    },
    /**
     * Reset user password to new one
     * @param user {object} : contains the detail for whom his acount pass will be reset
     * @param oldPassword {string} : the old password of this user
     * @param newPassword {string} : the new password for this user
     * @param callback {function(error,result)} : method to be executed on completion
     * @param isChange {boolean } : whether is reset ot change
     */
    setPassword: function (user, oldPassword, newPassword, isChange, callback) {

        // fetch the user and check that the passwords do match
        mongoUtils.query(COLLECTIONS.USERS, user, function (error, result) {
            if (error) {
                callback(error, MESSAGES.DB_FETCH_ERROR);
            }
            else {
                // compare the password
                bcrypt.compare(oldPassword, result[0].password, function (error, isMatch) {

                    if (isChange) {
                        if (error) {
                            callback(error, MESSAGES.DB_FETCH_ERROR);
                        }
                        else if (!isMatch) {
                            /** to change password , the oldPassword must matches the one in the DB*/
                            callback(error, MESSAGES.PASSWORD_NOT_MATCH_ERROR);
                        }
                        return;
                    }

                    //updating to new password
                    doPasswordHash(newPassword, function (error, hashedPassword) {
                        if (error)
                            callback(error, hashedPassword);

                        mongoUtils.update(COLLECTIONS.USERS, user, {$set: {password: hashedPassword}}, {}, function (error, result) {
                            if (error) {
                                callback(error, MESSAGES.PASSWORD_UPDATING_ERROR);
                            }
                            else {
                                callback(error, MESSAGES.PASSWORD_UPDATE_SUCCESS);
                            }

                        });
                    });
                });
            }
        });
        //token is made
        // sent to the email
        // press the link
        // redirect to change password page
    },


    /**
     * Check if a user is authorized to access a certain route
     * @param role {string} : The user's role
     * @param action {string} : The action the user is trying to perform
     * @param callback {function}
     * @returns {function} Invoke callback function with appropriate error and result.
     */
    isAuthorized: function (role, action, callback) {

        mongoUtils.query(COLLECTIONS.ACTIONS, {action: action}, function (error, result) {

            if (error || !result || result.length !== 1)
                return callback({message: "Internal Server Error", code: HttpStatus.INTERNAL_SERVER_ERROR}, null);

            if (ROLES_HIERARCHY.indexOf(role) < ROLES_HIERARCHY.indexOf(result[0].role))
                return callback({message: "Not Allowed", code: HttpStatus.FORBIDDEN}, null);

            return callback(null, {success: true, role: role});
        });

    },


    /**
     * Gives a Allowed/NotAllowed for user to login
     * @param email {string}
     * @param password {string}
     * @param callback {function} : the function that the data will be sent to
     */
    login: function (email, password, callback) {

        debug('Login email', email);
        debug('Login password', password);
        if (!validate.email(email) || !validate.password(password))
            return callback("Invalid email or password", null);

        mongoUtils.query(COLLECTIONS.USERS, {email: email}, function (error, result) {

            if (error)
                return callback(error, result);

            if (result.length > 1)
                return callback("Found more than 1 user", null);

            debug('login query result', result);
            var user = result[0];

            bcrypt.compare(password, user.password, function (error, result) {

                debug('bcrypt compare error', error);
                debug('bcrypt compare result', result);

                if (!result)
                    user = null;

                callback(error, user);
            });
        });
    }
};
