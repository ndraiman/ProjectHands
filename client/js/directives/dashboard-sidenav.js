angular.module('ProjectHands')

.directive('dashboardSidenav', function() {
    return {
        restrict: 'E',
        replace: true,
        templateUrl: 'templates/directives/dashboard-sidenav.html',
        controller: function($scope) {
            
        }
    };
});
