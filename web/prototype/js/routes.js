angular.module('ProjectHands')

.config(function ($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise('/home');
    
    $stateProvider.state('home', {
        url: '/home',
        templateUrl: 'templates/home.html'
    });
    
});