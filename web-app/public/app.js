// Import the Firebase SDK modules from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Configuration matching the Android google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyBDf6PHDh9vY37kubSVPZz9frTKtDUiOCE",
  authDomain: "truth-guard-82952.firebaseapp.com",
  projectId: "truth-guard-82952",
  storageBucket: "truth-guard-82952.firebasestorage.app"
};

// Initialize Firebase
let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase initialized successfully on TruthGuard Web");
} catch (e) {
  console.error("Firebase initialization failed:", e);
}

// Session Dashboard Stats (initialized to match Android defaults)
let stats = {
  verified: 25,
  trueNews: 18,
  fakeNews: 7,
  accuracy: 92
};

// Mock Trending News items (matching Android layout)
const trendingNews = [
  { title: "Scientists discover new climate monitoring technology", source: "BBC" },
  { title: "AI transforming healthcare worldwide", source: "Reuters" },
  { title: "Space mission successfully reaches orbit", source: "NASA" },
  { title: "Global economy shows positive growth", source: "Bloomberg" },
  { title: "Education sector adopts AI learning tools", source: "UNESCO" }
];

document.addEventListener("DOMContentLoaded", () => {
  // Navigation elements
  const screens = {
    home: document.getElementById("screen-home"),
    verify: document.getElementById("screen-verify"),
    trending: document.getElementById("screen-trending"),
    dashboard: document.getElementById("screen-dashboard"),
    about: document.getElementById("screen-about")
  };

  const navItems = {
    home: document.getElementById("nav-home"),
    verify: document.getElementById("nav-verify"),
    trending: document.getElementById("nav-trending"),
    dashboard: document.getElementById("nav-dashboard"),
    about: document.getElementById("nav-about")
  };

  // Switch Screen Helper
  function showScreen(screenKey) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
      screen.classList.remove("active");
    });
    // Remove active class from all nav items
    Object.values(navItems).forEach(item => {
      item.classList.remove("active");
    });

    // Show selected screen and activate nav item
    if (screens[screenKey]) {
      screens[screenKey].classList.add("active");
    }
    if (navItems[screenKey]) {
      navItems[screenKey].classList.add("active");
    }
  }

  // Bind Sidebar navigation
  Object.keys(navItems).forEach(key => {
    navItems[key].addEventListener("click", (e) => {
      e.preventDefault();
      showScreen(key);
    });
  });

  // Bind Quick Action buttons (from Home Screen)
  document.getElementById("btn-goto-verify").addEventListener("click", () => showScreen("verify"));
  document.getElementById("btn-goto-trending").addEventListener("click", () => showScreen("trending"));
  document.getElementById("btn-goto-dashboard").addEventListener("click", () => showScreen("dashboard"));
  document.getElementById("btn-goto-about").addEventListener("click", () => showScreen("about"));

  // Render Trending News
  const trendingContainer = document.getElementById("trending-list-container");
  trendingContainer.innerHTML = "";
  trendingNews.forEach(item => {
    const card = document.createElement("div");
    card.className = "news-card glass-card";
    card.innerHTML = `
      <div class="news-title">${item.title}</div>
      <div class="news-source">Source: ${item.source}</div>
    `;
    trendingContainer.appendChild(card);
  });

  // Update Stats UI helper
  function updateStatsUI() {
    // Update Home
    document.getElementById("stat-quick-verified").textContent = stats.verified;
    document.getElementById("stat-quick-accuracy").textContent = `${stats.accuracy}%`;

    // Update Dashboard
    document.getElementById("dashboard-total").textContent = stats.verified;
    document.getElementById("dashboard-true").textContent = stats.trueNews;
    document.getElementById("dashboard-fake").textContent = stats.fakeNews;
    document.getElementById("dashboard-accuracy").textContent = `${stats.accuracy}%`;
  }

  // Initialize UI stats
  updateStatsUI();

  // News verification logic
  const newsInput = document.getElementById("news-input");
  const analyzeBtn = document.getElementById("analyze-btn");
  const resultCard = document.getElementById("result-card");
  const resultTitle = document.getElementById("result-title");
  const resultConfidence = document.getElementById("result-confidence");
  const resultRec = document.getElementById("result-recommendation");

  analyzeBtn.addEventListener("click", async () => {
    const text = newsInput.value.trim();
    if (!text) {
      alert("Please paste some news content to analyze.");
      return;
    }

    const lowerText = text.toLowerCase();
    let isFake = false;

    // Matching exact classification logic as Android app
    if (
      lowerText.includes("fake") ||
      lowerText.includes("hoax") ||
      lowerText.includes("rumor") ||
      lowerText.includes("clickbait") ||
      lowerText.includes("shocking")
    ) {
      isFake = true;
    }

    let resultMsg = "";
    let confidenceMsg = "";
    let recommendationMsg = "";
    let resultClass = "";

    if (isFake) {
      resultMsg = "❌ Likely Fake News";
      confidenceMsg = "Confidence Score : 88%";
      recommendationMsg = "Recommendation:<br>Verify this news using trusted sources before sharing.";
      resultClass = "text-danger";

      stats.fakeNews += 1;
    } else {
      resultMsg = "✅ Likely Genuine News";
      confidenceMsg = "Confidence Score : 94%";
      recommendationMsg = "Recommendation:<br>This news appears reliable.";
      resultClass = "text-success";

      stats.trueNews += 1;
    }

    stats.verified += 1;
    stats.accuracy = Math.round((stats.trueNews / stats.verified) * 100);

    // Update UI elements
    resultTitle.className = `result-title ${resultClass}`;
    resultTitle.textContent = resultMsg;
    resultConfidence.textContent = confidenceMsg;
    resultRec.innerHTML = recommendationMsg;

    // Show result card
    resultCard.classList.remove("hidden");

    // Update dashboard stats
    updateStatsUI();

    // Save Verification result to Firebase Firestore (matching FirebaseRepository.kt)
    if (db) {
      try {
        await addDoc(collection(db, "verifications"), {
          news: text,
          result: resultMsg,
          confidence: confidenceMsg,
          timestamp: Date.now()
        });
        console.log("Verification saved to Firestore.");
      } catch (err) {
        console.error("Error writing document to Firestore: ", err);
      }
    }
  });
});
