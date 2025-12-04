/**
 * main.js
 * Logic for the Landing Page (index.html)
 * Handles Auth simulation and navigation.
 */

import { uuid } from "./utils.js"; // Optional: if you want to use the shared uuid generator

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const firebaseConfig = window.FIREBASE_CONFIG;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider(); // Initialize Google Provider

// === UI UPDATER ===
function updateLandingUI(user) {
  const authBtn = document.getElementById("auth-btn");
  const startBtn = document.getElementById("start-chatting-btn");

  if (!authBtn || !startBtn) return;

  if (user) {
    // Show "Sign Out" or user's first name
    const name = user.displayName ? user.displayName.split(' ')[0] : "User";
    authBtn.textContent = `Sign Out (${name})`;
    startBtn.style.opacity = "1";
    startBtn.style.cursor = "pointer";
  } else {
    authBtn.textContent = "Sign In with Google";
    startBtn.style.opacity = "0.6";
  }
}

// === MAIN LOGIC ===
document.addEventListener("DOMContentLoaded", () => {
  const authBtn = document.getElementById("auth-btn");
  const startBtn = document.getElementById("start-chatting-btn");

  // 1. Monitor Auth State
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Save User Details to LocalStorage for chat.js
      localStorage.setItem("user_id", user.uid);
      localStorage.setItem("user_email", user.email);
      localStorage.setItem("user_name", user.displayName); // Save name too
      
      updateLandingUI(user);
    } else {
      localStorage.removeItem("user_id");
      localStorage.removeItem("user_email");
      localStorage.removeItem("user_name");
      updateLandingUI(null);
    }
  });

  // 2. Handle Sign In / Sign Out Button
  if (authBtn) {
    authBtn.addEventListener("click", () => {
      const user = auth.currentUser;

      if (user) {
        // === SIGN OUT ===
        if (confirm("Are you sure you want to sign out?")) {
          signOut(auth).catch((error) => console.error(error));
        }
      } else {
        // === SIGN IN WITH GOOGLE ===
        authBtn.textContent = "Opening Google...";
        
        signInWithPopup(auth, provider)
          .then((result) => {
            console.log("Signed in as:", result.user.email);
            // Redirect to chat immediately
            window.location.href = "/chat/";
          })
          .catch((error) => {
            console.error("Login Failed:", error);
            authBtn.textContent = "Sign In with Google";
            
            // Handle common errors
            if (error.code === 'auth/popup-closed-by-user') {
              alert("Sign-in cancelled.");
            } else {
              alert(`Error: ${error.message}`);
            }
          });
      }
    });
  }

  // 3. Handle Start Chatting Button (Guard)
  if (startBtn) {
    startBtn.addEventListener("click", (e) => {
      if (!auth.currentUser) {
        e.preventDefault(); 
        alert("Please Sign In with Google to start chatting.");
      }
      // If logged in, href="chat.html" works automatically
    });
  }
});