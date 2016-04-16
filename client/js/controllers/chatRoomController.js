angular.module('ProjectHands')

.controller('ChatRoomController', function ($scope, $timeout, socketio, DatabaseService, COLLECTIONS) {

    //Message Classes
    var class_message_self = 'chat-message-self';
    var class_message_others = 'chat-message-others';


//    $scope.room = $attrs.room;
//    $scope.user = $attrs.user;
//    console.log('chat-room user', $scope.user);
//    console.log('chat-room room', $scope.room);

    $scope.history = [];

    $scope.message = {
        user: $scope.user.name,
        content: '',
        timestamp: '',
        class: class_message_self,
        align: 'end'
    };

    socketio.emit('room.join', $scope.room);
    getChatHistory();


    $scope.sendMessage = function () {

        if ($scope.ChatMessageForm.$invalid)
            return;

        $scope.message.timestamp = new Date();
        $scope.history.push(parseTimestamp(angular.copy($scope.message)));

        //Don't save dir and class to DB.
        var message = angular.copy($scope.message);
        delete message.dir;
        delete message.class;

        socketio.emit('message', message, $scope.room, function (data) {
            console.log('Ack: ', data);
        });

        //reset form
        $scope.ChatMessageForm.$setPristine();
        $scope.ChatMessageForm.$setUntouched();
        $scope.message.content = '';
    };

    socketio.on('message', function (message) {
        $scope.$apply(function () {
            message.dir = isHebrew(message.user) ? 'rtl' : 'ltr';
            message.class = class_message_others;
            $scope.history.push(parseTimestamp(message));
        });
    });


    //Change date object to HH:MM format
    function parseTimestamp(message) {
        var date = new Date(message.timestamp);
        var minutes = date.getMinutes();
        var hours = date.getHours();
        if (minutes < 10)
            minutes = '0' + minutes;
        if (hours < 10)
            hours = '0' + hours;

        message.timestamp = hours + ':' + minutes;

        return message;
    }


    //Get chat history
    function getChatHistory() {

        DatabaseService.query(COLLECTIONS.CHATS, {
                _id: $scope.room
            }).$promise
            .then(function (data) {
                console.log('data', data);
                if (data.length > 0)
                    $scope.history = data[0].messages;

                $scope.history.forEach(function (message) {
                    message.class = $scope.user.name === message.user ? class_message_self : class_message_others;
                    message.align = $scope.user.name === message.user ? "end" : "start";

                    return parseTimestamp(message);
                });

            })
            .catch(function (error) {
                console.log('chat query error', error);
            });
    }

    $scope.showUsername = function(message, index)  {
        if(message.user === $scope.user.name)
            return false;

        if(index === 0)
            return true;

        return (message.user !== $scope.history[index-1].user);
    };

    //Regex for hebrew unicode chars
    function isHebrew(message) {
        return message.match(/[\u0590-\u05FF]+/);
    }

    $scope.$watchCollection('history', function(newVal, oldVal, scope) {
//        console.log("History Changed");
        scrollToBottom(".chat-message-list");
    });


    function scrollToBottom(elementSelector) {
        $timeout(function () {
            var element = angular.element(elementSelector);
            element.scrollTop(element[0].scrollHeight);
        });
    }

});
