import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ArrowRight, Star, Users, Shield } from "lucide-react";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || 'https://swapflow-app-uj7o.vercel.app').replace(/\/+$/, ''); // Remove trailing slashes
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '230390770808-2u6f0s330fntsf8878mukt32a9crmqro.apps.googleusercontent.com';

const Landing = () => {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [featuredItems, setFeaturedItems] = useState([]);

  useEffect(() => {
    // Check for OAuth callback (ID token in URL hash)
    const hash = window.location.hash;
    if (hash && hash.includes('id_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const idToken = params.get('id_token');
      if (idToken) {
        console.log('Found ID token in URL, processing...');
        handleGoogleSignIn({ credential: idToken });
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
    }

    // Wait for Google script to load, then initialize
    const initGoogleSignIn = () => {
      if (window.google && GOOGLE_CLIENT_ID) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn,
          });
          console.log('Google Sign-In initialized');
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error);
        }
      }
    };

    // Check if Google script is already loaded
    if (window.google) {
      initGoogleSignIn();
    } else {
      // Wait for script to load
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initGoogleSignIn();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkGoogle);
        if (!window.google) {
          console.warn('Google Sign-In script did not load within 5 seconds');
        }
      }, 5000);
    }

    // Check if already authenticated
    const checkAuth = async () => {
      if (!API) {
        setIsCheckingAuth(false);
        return;
      }
      try {
        const response = await axios.get(`${API}/auth/me`, { 
          withCredentials: true,
          timeout: 10000
        });
        if (response.data) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        // Not authenticated, show landing
      } finally {
        setIsCheckingAuth(false);
      }
    };

    // Fetch featured items for preview
    const fetchItems = async () => {
      if (!API) return;
      try {
        const response = await axios.get(`${API}/items`, { timeout: 10000 });
        setFeaturedItems(response.data.slice(0, 6));
      } catch {
        // Ignore errors
      }
    };

    checkAuth();
    fetchItems();
  }, [navigate]);

  const handleGoogleSignIn = async (response) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Landing.jsx:104',message:'handleGoogleSignIn called',data:{hasCredential:!!response?.credential,credentialLength:response?.credential?.length,API,API_type:typeof API},"timestamp":Date.now(),sessionId:"debug-session",runId:"run1",hypothesisId:"H1"})}).catch(()=>{});
    // #endregion

    if (!API) {
      console.error('API URL not configured');
      alert('Backend URL not configured. Please check environment variables.');
      return;
    }

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Landing.jsx:112',message:'Sending auth request',data:{url:`${API}/auth/google`,hasCredential:!!response?.credential},"timestamp":Date.now(),sessionId:"debug-session",runId:"run1",hypothesisId:"H1"})}).catch(()=>{});
      // #endregion

      // Send the credential to backend
      const authResponse = await axios.post(
        `${API}/auth/google`,
        { credential: response.credential },
        { 
          withCredentials: true,
          timeout: 15000 // 15 second timeout
        }
      );

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Landing.jsx:122',message:'Auth response received',data:{status:authResponse.status,hasUser:!!authResponse.data?.user,userId:authResponse.data?.user?.user_id,hasSessionToken:!!authResponse.data?.session_token,cookies:document.cookie},"timestamp":Date.now(),sessionId:"debug-session",runId:"run1",hypothesisId:"H1"})}).catch(()=>{});
      // #endregion

      if (authResponse.data && authResponse.data.user) {
        // Store session token as fallback if cookie doesn't work
        if (authResponse.data.session_token) {
          localStorage.setItem('session_token', authResponse.data.session_token);
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Landing.jsx:134',message:'Auth successful, checking cookies before navigation',data:{userId:authResponse.data.user.user_id,cookies:document.cookie,hasSessionCookie:document.cookie.includes('session_token'),hasStoredToken:!!localStorage.getItem('session_token')},"timestamp":Date.now(),sessionId:"debug-session",runId:"run1",hypothesisId:"H1"})}).catch(()=>{});
        // #endregion
        // Small delay to ensure cookie is set
        setTimeout(() => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Landing.jsx:142',message:'Navigating to dashboard',data:{cookies:document.cookie},"timestamp":Date.now(),sessionId:"debug-session",runId:"run1",hypothesisId:"H1"})}).catch(()=>{});
          // #endregion
          navigate("/dashboard", { replace: true });
        }, 500); // Increased delay to ensure cookie is set
      } else {
        console.error('No user data in auth response');
        alert('Authentication failed. Please try again.');
      }
    } catch (error) {
      // #region agent log
      const errorData = {
        errorMessage: error.message,
        errorType: error.name,
        errorCode: error.code,
        hasResponse: !!error.response,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        isTimeout: error.code === 'ECONNABORTED',
        requestURL: `${API}/auth/google`,
        requestMethod: 'POST'
      };
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Landing.jsx:131',message:'Auth error caught',data:errorData,"timestamp":Date.now(),sessionId:"debug-session",runId:"run1",hypothesisId:"H1"})}).catch(()=>{});
      console.error("Auth error details:", errorData);
      // #endregion
      console.error("Auth error:", error);
      if (error.response) {
        console.error("Error response:", error.response.data);
        alert(`Authentication failed: ${error.response.data?.detail || error.message}`);
      } else if (error.code === 'ECONNABORTED') {
        alert('Request timed out. The server may be slow or unreachable.');
      } else if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
        alert('Network error: Cannot reach the server. Please check your connection and try again.');
      } else {
        alert(`Network error: ${error.message}. Please check your connection and try again.`);
      }
    }
  };

  const handleGoogleLogin = (e) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('Button clicked!', { 
      GOOGLE_CLIENT_ID, 
      GOOGLE_CLIENT_ID_type: typeof GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_ID_length: GOOGLE_CLIENT_ID?.length,
      GOOGLE_CLIENT_ID_trimmed: GOOGLE_CLIENT_ID?.trim(),
      isFalsy: !GOOGLE_CLIENT_ID,
      equalsPlaceholder: false,
      hasGoogle: !!window.google,
      hasAccounts: !!(window.google && window.google.accounts)
    });
    
    // Check if Google Client ID is configured
    const clientId = GOOGLE_CLIENT_ID?.trim();
    if (!clientId || clientId === '') {
      alert('Google OAuth is not configured. Please set REACT_APP_GOOGLE_CLIENT_ID in your .env file.\n\nCurrent value: "' + (GOOGLE_CLIENT_ID || 'undefined') + '"\n\nSee SETUP_LOCAL.md for instructions on setting up Google OAuth.');
      console.error('Google Client ID not configured. Current value:', GOOGLE_CLIENT_ID, 'Type:', typeof GOOGLE_CLIENT_ID);
      return;
    }

    console.log('Proceeding with Google OAuth, Client ID:', clientId);

    // Use Google Sign-In JavaScript API (doesn't require redirect URI)
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        console.log('Using Google Sign-In JavaScript API...');
        
        // Make sure it's initialized
        if (!window.google.accounts.id._initialized) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleSignIn,
          });
        }
        
        // Try to show the One Tap prompt
        window.google.accounts.id.prompt((notification) => {
          console.log('Google prompt notification:', notification);
          if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
            // If prompt doesn't show, render a button instead
            console.log('Prompt not displayed, will use button click method');
            // The button will trigger the sign-in flow
            window.google.accounts.id.renderButton(
              document.getElementById('google-signin-button') || document.body,
              {
                theme: 'outline',
                size: 'large',
                width: 300,
                text: 'signin_with',
              }
            );
          }
        });
      } catch (error) {
        console.error('Error with Google Sign-In API:', error);
        // Fallback: use redirect (requires redirect URI to be configured)
        console.log('Falling back to redirect method...');
        const redirectUrl = window.location.origin;
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=id_token&scope=openid email profile&nonce=${Math.random()}`;
        window.location.href = googleAuthUrl;
      }
    } else {
      // Google script not loaded, use redirect (requires redirect URI to be configured)
      console.log('Google script not loaded, using redirect method...');
      console.warn('⚠️ Redirect method requires http://localhost:3000 to be added to Authorized redirect URIs in Google Cloud Console');
      const redirectUrl = window.location.origin;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=id_token&scope=openid email profile&nonce=${Math.random()}`;
      window.location.href = googleAuthUrl;
    }

    // Try to use Google Sign-In API (commented out for now)
    if (false && window.google && window.google.accounts && window.google.accounts.id) {
      try {
        console.log('Using Google Sign-In prompt with Client ID:', clientId);
        
        // Initialize if not already done
        if (!window.google.accounts.id._initialized) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleSignIn,
          });
        }
        
        // Try to show the prompt
        window.google.accounts.id.prompt((notification) => {
          console.log('Google prompt notification:', notification);
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.warn('Google prompt not displayed, trying renderButton instead');
            // Fallback: render a button
            const buttonContainer = document.getElementById('google-signin-button');
            if (buttonContainer) {
              window.google.accounts.id.renderButton(buttonContainer, {
                theme: 'outline',
                size: 'large',
                width: 300,
              });
            } else {
              // Last resort: redirect
              console.log('Redirecting to Google OAuth...');
              const redirectUrl = window.location.origin;
              const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=id_token&scope=openid email profile&nonce=${Math.random()}`;
              window.location.href = googleAuthUrl;
            }
          }
        });
      } catch (error) {
        console.error('Error with Google Sign-In prompt:', error);
        // Fallback to redirect
        console.log('Falling back to redirect method...');
        const redirectUrl = window.location.origin;
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=id_token&scope=openid email profile&nonce=${Math.random()}`;
        window.location.href = googleAuthUrl;
      }
    } else {
      console.error('Google Sign-In API not available', {
        hasGoogle: !!window.google,
        hasAccounts: !!(window.google && window.google.accounts),
        hasId: !!(window.google && window.google.accounts && window.google.accounts.id)
      });
      // Fallback to redirect method
      console.log('Google script not loaded, using redirect method...');
      const redirectUrl = window.location.origin;
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=id_token&scope=openid email profile&nonce=${Math.random()}`;
      window.location.href = googleAuthUrl;
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* Header */}
      <header className="glass-header fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                SwapFlow
              </span>
            </div>
            <Button
              onClick={handleGoogleLogin}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 shadow-lg hover:shadow-indigo-500/30 transition-all duration-300"
              data-testid="login-btn"
            >
              Sign in with Google
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pb-24 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight mb-6"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Trade Items You Love,
              <br />
              <span className="text-indigo-600">Without Spending a Dime</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              SwapFlow connects you with people looking to trade. Post your items,
              discover amazing finds, and swap directly with others in your community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleGoogleLogin}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-indigo-500/30 transition-all duration-300"
                data-testid="hero-cta-btn"
              >
                Start Trading
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Items Preview */}
      {featuredItems.length > 0 && (
        <section className="py-16 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
            <h2
              className="text-3xl font-semibold text-slate-900 text-center mb-12"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              What People Are Trading
            </h2>
            <div className="masonry-grid">
              {featuredItems.map((item) => (
                <div
                  key={item.item_id}
                  className="masonry-item rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full object-cover"
                    style={{ minHeight: "150px" }}
                  />
                  <div className="p-4">
                    <h3 className="font-medium text-slate-900 line-clamp-1">{item.title}</h3>
                    <p className="text-sm text-slate-500 capitalize">{item.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="py-16 md:py-24 px-4 md:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ArrowLeftRight className="w-7 h-7 text-indigo-600" />
              </div>
              <h3
                className="text-xl font-semibold text-slate-900 mb-2"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Easy Trading
              </h3>
              <p className="text-slate-600">
                Post your items, browse others, and trade directly. No money needed.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Star className="w-7 h-7 text-teal-600" />
              </div>
              <h3
                className="text-xl font-semibold text-slate-900 mb-2"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Build Reputation
              </h3>
              <p className="text-slate-600">
                Earn trade points and ratings. Build trust with every successful swap.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-amber-600" />
              </div>
              <h3
                className="text-xl font-semibold text-slate-900 mb-2"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Safe & Secure
              </h3>
              <p className="text-slate-600">
                Both parties confirm trades. Rate your experience after each swap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-indigo-600">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Ready to Start Trading?
          </h2>
          <p className="text-indigo-100 mb-8">
            Join SwapFlow today and discover a new way to exchange items.
          </p>
          <Button
            onClick={handleGoogleLogin}
            size="lg"
            className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-full px-8 py-6 text-lg shadow-lg transition-all duration-300"
            data-testid="footer-cta-btn"
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <ArrowLeftRight className="w-4 h-4" />
            <span className="text-sm">SwapFlow © 2025</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
