// PWA Service Worker Registration
// Add this to your existing script.js or create a new file

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 New service worker found, installing...');
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🎉 New content available, please refresh!');
              // You could show a toast notification here
            }
          });
        });
      })
      .catch(error => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

// PWA Install Prompt
let deferredPrompt;
let installButton;

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('💡 PWA install prompt available');
  
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show install button (if you have one)
  showInstallButton();
});

// Function to show install button
function showInstallButton() {
  // If you have an install button in your HTML, show it here
  installButton = document.getElementById('install-button');
  if (installButton) {
    installButton.style.display = 'block';
    installButton.addEventListener('click', installApp);
  }
}

// Function to trigger install
function installApp() {
  if (deferredPrompt) {
    // Show the prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('🎉 User accepted the install prompt');
      } else {
        console.log('😞 User dismissed the install prompt');
      }
      deferredPrompt = null;
      
      // Hide install button
      if (installButton) {
        installButton.style.display = 'none';
      }
    });
  }
}

// Listen for app installed event
window.addEventListener('appinstalled', (evt) => {
  console.log('🎉 Highfield Villa PWA was installed!');
  
  // Hide install button if visible
  if (installButton) {
    installButton.style.display = 'none';
  }
  
  // You could track this event for analytics
  // analytics.track('pwa-installed');
});

// Check if app is running in standalone mode
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

// Add some PWA-specific styling when in standalone mode
if (isStandalone()) {
  console.log('🏠 Running in standalone mode');
  document.body.classList.add('standalone');
}