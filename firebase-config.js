// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyD6Hvq_MR6t3EzFd3SqNc9q4Dq8qV9wX5M",
    authDomain: "business-card-scanner-pro.firebaseapp.com",
    projectId: "business-card-scanner-pro",
    storageBucket: "business-card-scanner-pro.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890",
    databaseURL: "https://business-card-scanner-pro-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
