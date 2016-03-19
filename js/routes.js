angular.module('ProjectHands')

.config(function ($stateProvider, $urlRouterProvider) {
    
    $urlRouterProvider.otherwise('/home');
    
    $stateProvider.state('home', {
        url: '/home',
        templateUrl: 'templates/home.html'
    })
    
    .state('about', {
       url: '/about',
        templateUrl: 'templates/about/index.html',
        controller: 'AboutController',
        deepStateRedirect: { default: { state: 'about.who' } }
    })
    
    .state('about.who', {
        url: '/who',
        templateUrl: 'templates/about/who.html'
    })
    
    .state('about.jobs', {
        url: '/jobs',
        templateUrl: 'templates/about/jobs.html'
    })
    
    .state('about.volunteers', {
        url: '/volunteers',
        templateUrl: 'templates/about/volunteers.html'
    });
    
    
});