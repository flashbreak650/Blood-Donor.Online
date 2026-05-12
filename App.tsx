import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Droplet, Search, Bell, X, User, Heart, Phone, MapPin, Share2, Star,
  Home, UserPlus, CheckCircle2, ShieldCheck, Activity, Smartphone,
  Download, Upload, Trash2, Edit3, BellRing, HeartHandshake, BadgeDollarSign,
  MessageSquare, ThumbsUp, Send, MessageCircle, MoreHorizontal, Image as ImageIcon, Reply, Camera, AlertCircle, UserCircle2, Copy,
  LayoutGrid, FileText, Settings, RefreshCw, AlertTriangle, Database, ShieldAlert
} from "lucide-react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove, runTransaction, get, update } from "firebase/database";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBrWesq_t5fuUPcCfwKDdpIjBaHumhQg-g",
  authDomain: "blood-donor-online.firebaseapp.com",
  databaseURL: "https://blood-donor-online-default-rtdb.firebaseio.com",
  projectId: "blood-donor-online"
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// --- Types ---
type Toast = { id: number; message: string; type: "success" | "info" | "warning" };
type Donor = {
  key: string;
  name: string;
  blood: string;
  type: string;
  loc: string;
  phone: string;
  weight: string;
  last: string;
  times: string;
  canDonate: string;
  bio: string;
  fb: string;
  wa: string;
  profileImg?: string;
  rating?: number;
  followers?: number;
  banned?: boolean;
};

type Report = {
  key: string;
  reportedKey: string;
  reporterKey: string;
  reason: string;
  timestamp: number;
};

type AppSettings = {
  bannerText: string;
  showBanner: boolean;
  chatEnabled: boolean;
  bikashNumber: string;
  nagadNumber: string;
  adminEmail: string;
  adminPin: string;
  allowGlobalEdit: boolean;
};

type ChatMessage = {
  key: string;
  senderName: string;
  senderPhone: string;
  senderKey: string;
  text: string;
  image?: string;
  replyToKey?: string;
  replyToName?: string;
  replyToText?: string;
  timestamp: number;
};

type PostComment = {
  key: string;
  authorKey: string;
  authorName: string;
  authorPhone: string;
  authorImg?: string;
  text: string;
  timestamp: number;
};

type CommunityPost = {
  key: string;
  text: string;
  image?: string;
  authorKey: string;
  authorName: string;
  authorPhone: string;
  authorImg?: string;
  timestamp: number;
  likes?: Record<string, boolean>;
  comments?: Record<string, PostComment>;
};

type Notice = {
  key: string;
  title: string;
  text: string;
  timestamp: number;
};

type RecoveryRequest = {
  phone: string;
  status: "pending" | "approved";
  otp?: string;
  timestamp: number;
};

const compressImage = (file: File, maxSizeMB = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- Main Application ---
export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<"feed" | "profile" | "community" | "admin" | "recovery" | "chat">("feed");
  const [donors, setDonors] = useState<Donor[]>([]);
  const [archivedDonors, setArchivedDonors] = useState<Donor[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ 
    bannerText: "স্বাগত! রক্তদান জীবন দান। জরুরি প্রয়োজনে যোগাযোগ করুন।", 
    showBanner: true, 
    chatEnabled: true,
    bikashNumber: "017XXXXXXXX",
    nagadNumber: "018XXXXXXXX",
    adminEmail: "mdemon60305@gmail.com",
    adminPin: "1234",
    allowGlobalEdit: true
  });

  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: "", text: "" });
  const [recoveryOtpInput, setRecoveryOtpInput] = useState("");
  const [waitingForOtp, setWaitingForOtp] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState<"overview" | "posts" | "settings" | "recovery" | "reports" | "archive" | "active" | "offline">("overview");
  const [lastSeenNoticeTimestamp, setLastSeenNoticeTimestamp] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedLastNotice = localStorage.getItem("lastSeenNoticeTimestamp");
    if (storedLastNotice) setLastSeenNoticeTimestamp(parseInt(storedLastNotice));
  }, []);

  const unreadNoticesCount = notices.filter(n => n.timestamp > lastSeenNoticeTimestamp).length;

  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [dollarCardPost, setDollarCardPost] = useState<CommunityPost | null>(null);
  const [reportModal, setReportModal] = useState<{isOpen: boolean, donorKey: string} | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [longPressMsg, setLongPressMsg] = useState<ChatMessage | null>(null);
  const [guestName, setGuestName] = useState("");
  const [isGuestNameModalOpen, setIsGuestNameModalOpen] = useState(false);
  const [lastSeenMsgCount, setLastSeenMsgCount] = useState(0);
  const [isMeInChat, setIsMeInChat] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [activeDonorMenu, setActiveDonorMenu] = useState<string | null>(null);
  const [logoClicks, setLogoClicks] = useState(0);
  const [recoveryPhone, setRecoveryPhone] = useState("");
  const [newPostText, setNewPostText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [activePostIdForComment, setActivePostIdForComment] = useState<string | null>(null);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [activeDonorModal, setActiveDonorModal] = useState<Donor | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [filter, setFilter] = useState<"all" | "হ্যাঁ" | "না" | "fav">("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [myKey, setMyKey] = useState<string | null>(null);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Profile Form State
  const [formData, setFormData] = useState({
    name: "", blood: "", type: "", loc: "", phone: "", weight: "", 
    last: "", times: "", canDonate: "হ্যাঁ", bio: "", fb: "", wa: "", profileImg: ""
  });
  const [newPostImg, setNewPostImg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notiPermission, setNotiPermission] = useState<string>("default");

  // Global Notice/Toast Handler
  const showNotice = (message: string, type: Toast["type"] = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // Setup App
  useEffect(() => {
    const storedGuestName = localStorage.getItem("myGuestName");
    if (storedGuestName) setGuestName(storedGuestName);

    const storedFavs = localStorage.getItem("myFavDonors");
    if (storedFavs) setFavorites(JSON.parse(storedFavs));

    const storedKey = localStorage.getItem("myDonorKey");
    if (storedKey) {
      setMyKey(storedKey);
      get(ref(database, `donors/${storedKey}`)).then(snap => {
        if (!snap.exists()) {
          localStorage.removeItem("myDonorKey");
          setMyKey(null);
        } else {
          setFormData(snap.val());
        }
      });
    }

    // Listen to all donors
    const donorsRef = ref(database, "donors/");
    const unsubscribeDonors = onValue(donorsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedDonors: Donor[] = Object.keys(data).map(key => ({
          key,
          ...data[key]
        }));
        setDonors(loadedDonors.reverse()); 
      } else {
        setDonors([]);
      }
    });

    // Listen to community posts
    const postsRef = ref(database, "posts/");
    const unsubscribePosts = onValue(postsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedPosts: CommunityPost[] = Object.keys(data).map(key => ({
          key,
          ...data[key]
        }));
        setPosts(loadedPosts.sort((a,b) => b.timestamp - a.timestamp)); 
      } else {
        setPosts([]);
      }
    });

    // Listen to reports
    const reportsRef = ref(database, "reports/");
    const unsubscribeReports = onValue(reportsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedReports: Report[] = Object.keys(data).map(key => ({
          key,
          ...data[key]
        }));
        setReports(loadedReports.sort((a,b) => b.timestamp - a.timestamp)); 
      } else {
        setReports([]);
      }
    });

    // Listen to settings
    const settingsRef = ref(database, "settings/");
    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setAppSettings({
          bannerText: snapshot.val().bannerText || "",
          showBanner: snapshot.val().showBanner || false,
          chatEnabled: snapshot.val().chatEnabled ?? true,
          bikashNumber: snapshot.val().bikashNumber || "017XXXXXXXX",
          nagadNumber: snapshot.val().nagadNumber || "018XXXXXXXX",
          adminEmail: snapshot.val().adminEmail || "mdemon60305@gmail.com",
          adminPin: snapshot.val().adminPin || "1234",
          allowGlobalEdit: snapshot.val().allowGlobalEdit ?? true
        });
      }
    });

    // Listen to chat
    const chatRef = ref(database, "chat/");
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: ChatMessage[] = Object.keys(data).map(key => ({
          key,
          ...data[key]
        }));
        setChatMessages(loaded.sort((a,b) => a.timestamp - b.timestamp));
      } else {
        setChatMessages([]);
      }
    });

    // Listen to notices
    const noticesRef = ref(database, "notices/");
    const unsubscribeNotices = onValue(noticesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: Notice[] = Object.keys(data).map(key => ({
          key,
          ...data[key]
        }));
        setNotices(loaded.sort((a,b) => b.timestamp - a.timestamp));
      } else {
        setNotices([]);
      }
    });

    // Listen to recovery requests (admin only usually, but we'll fetch all and filter in UI for admin, and user will listen to their specific one)
    const recoveryRef = ref(database, "recovery_requests/");
    const unsubscribeRecovery = onValue(recoveryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: RecoveryRequest[] = Object.keys(data).map(key => ({
          phone: key,
          ...data[key]
        }));
        setRecoveryRequests(loaded.sort((a,b) => b.timestamp - a.timestamp));
      } else {
        setRecoveryRequests([]);
      }
    });

    // Listen to archived donors
    const archivedRef = ref(database, "archived_donors/");
    const unsubscribeArchived = onValue(archivedRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loaded: Donor[] = Object.keys(data).map(key => ({
          key,
          ...data[key]
        }));
        setArchivedDonors(loaded);
      } else {
        setArchivedDonors([]);
      }
    });

  // Removed temporary auto-unban logic due to infinite loop causing white screen

    // PWA Install prompt listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setIsPwaModalOpen(true), 3000); 
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      unsubscribeDonors();
      unsubscribePosts();
      unsubscribeReports();
      unsubscribeSettings();
      unsubscribeChat();
      unsubscribeNotices();
      unsubscribeRecovery();
      unsubscribeArchived();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // Emergency Unban Logic: If the current user (from localStorage) is banned, unban them.
  // This helps the owner get back in if they accidentally ban themselves during testing.
  useEffect(() => {
    if (myKey) {
      const userRef = ref(database, `donors/${myKey}`);
      get(userRef).then(snap => {
        if (snap.exists() && snap.val().banned) {
          update(userRef, { banned: false });
          showNotice("আপনার অ্যাকাউন্টটি অটোমেটিক আনব্যান করা হয়েছে।", "success");
        }
      });
    }
  }, [myKey]);

  // --- Push Notification Setup ---
  useEffect(() => {
    if ('Notification' in window) {
      setNotiPermission(Notification.permission);
    }
    
    // Automated reminder
    const sendReminder = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notices = [
          "জরুরী রক্তের প্রয়োজন? আমাদের অ্যাপে খুঁজুন 🩸",
          "আপনার এক ফোঁটা রক্ত বাঁচাতে পারে একটি প্রাণ! ❤️",
          "পরিচিত কাউকে ইনভাইট করুন ব্লাড ডোনার অ্যাপে। 🤝",
          "রক্তদান ক্যাম্পের আপডেট পেতে অ্যাপে চোখ রাখুন!"
        ];
        const randomNotice = notices[Math.floor(Math.random() * notices.length)];
        
        try {
          if (navigator.serviceWorker) {
            navigator.serviceWorker.getRegistration().then((reg) => {
              if (reg) {
                reg.showNotification('Blood Donor Online', { body: randomNotice });
              } else {
                new Notification('Blood Donor Online', { body: randomNotice });
              }
            });
          } else {
            new Notification('Blood Donor Online', { body: randomNotice });
          }
        } catch (e) {
          try { new Notification('Blood Donor Online', { body: randomNotice }); } catch(err) {}
        }
      }
    };

    // Send a push notification every 3 hours to remind users about the app
    const intervalId = setInterval(sendReminder, 1000 * 60 * 60 * 3);
    return () => clearInterval(intervalId);
  }, []);

  const requestNotification = async () => {
    if (!('Notification' in window)) {
      showNotice("আপনার ডিভাইস নোটিফিকেশন সাপোর্ট করে না", "warning");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotiPermission(perm);
      if (perm === 'granted') {
        showNotice("নোটিফিকেশন চালু হয়েছে!", "success");
        new Notification('Blood Donor Online 🩸', {
          body: 'ধন্যবাদ! এখন থেকে আপনি নিয়মিত আপডেট এবং রিমাইন্ডার পাবেন।',
        });
      } else {
        showNotice("নোটিফিকেশন অনুমতি দেওয়া হয়নি", "warning");
      }
    } catch(e) {
       console.error(e);
    }
  };

  const handleInstallClick = async () => {
    setIsPwaModalOpen(false);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User interaction with install prompt: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      showNotice("আপনার মোবাইল ব্রাউজারের অপশন থেকে 'Add to Home Screen' ক্লিক করুন।", "info");
    }
  };

  const copyShareLink = () => {
    const infoText = "রক্তদান সেবাকে আরও সহজ ও দ্রুত করতে আমাদের অফিসিয়াল অ্যাপটি ইনস্টল করুন।\n\nঅ্যান্ড্রয়েড অ্যাপ: https://www.mediafire.com/file/n89knndg1p9zxbb/_Blood_Donor_Online_19784143.apk/file";
    if (navigator.clipboard) {
      navigator.clipboard.writeText(infoText).then(() => showNotice("অ্যাপ ডাউনলোড লিঙ্ক কপি হয়েছে!", "success"));
    } else {
      showNotice("লিঙ্ক কপি করা সম্ভব হয়নি", "warning");
    }
  };

  const toggleFav = (key: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem("myFavDonors", JSON.stringify(newFavs));
      return newFavs;
    });
    showNotice(favorites.includes(key) ? "ফেভারিট থেকে সরানো হয়েছে" : "ফেভারিটে যুক্ত হয়েছে", "success");
  };

  const incrementFollowers = (key: string) => {
    runTransaction(ref(database, `donors/${key}/followers`), (currentCount) => (currentCount || 0) + 1);
    showNotice("আপনি ডোনারকে ফলো করেছেন", "success");
  };

  const giveRating = (key: string) => {
    set(ref(database, `donors/${key}/rating`), 98);
    showNotice("রেটিং দেওয়ার জন্য ধন্যবাদ!", "success");
  };

  const cleanPhone = (p: string) => {
    let cp = p.trim().replace(/[^0-9]/g, ""); // Keep only digits
    if (cp.startsWith("88")) cp = cp.substring(2); // Remove 88 prefix if present
    return cp;
  };

  const saveProfile = async () => {
    if (!formData.name || !formData.phone) {
      showNotice("নাম ও ফোন নম্বর দেওয়া আবশ্যক!", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      const profileData = {
        ...formData,
        phone: cleanPhone(formData.phone),
        rating: formData.rating || 95,
        followers: formData.followers || 1
      };
      let currentKey = myKey;
      if (!currentKey) {
        const newRef = push(ref(database, 'donors/'));
        currentKey = newRef.key;
        if(currentKey) {
          setMyKey(currentKey);
          localStorage.setItem('myDonorKey', currentKey);
        }
      }
      if(currentKey) {
        await set(ref(database, `donors/${currentKey}`), profileData);
        // Also save to archive for safe recovery even if deleted
        await set(ref(database, `archived_donors/${currentKey}`), {
          ...profileData,
          archivedAt: Date.now()
        });
        showNotice("প্রোফাইল সফলভাবে আপডেট হয়েছে!", "success");
        setActiveTab("feed");
      }
    } catch (e) {
      showNotice("সার্ভার ত্রুটি, আবার চেষ্টা করুন।", "warning");
    }
    setIsSubmitting(false);
  };

  const deleteProfile = async () => {
    setConfirmDialog({
      isOpen: true,
      message: "অ্যাকাউন্ট ডিলিট করতে চান? ডিলিট করলে আপনি আবার নতুন অ্যাকাউন্ট করতে পারবেন।",
      onConfirm: async () => {
        if (myKey) {
          await remove(ref(database, `donors/${myKey}`));
          localStorage.removeItem('myDonorKey');
          setMyKey(null);
          setFormData({ name: "", blood: "", type: "", loc: "", phone: "", weight: "", last: "", times: "", canDonate: "হ্যাঁ", bio: "", fb: "", wa: "", profileImg: "" });
          showNotice("আপনার প্রোফাইল মুছে ফেলা হয়েছে।", "info");
          setActiveTab("feed");
        }
        setConfirmDialog(null);
      }
    });
  };

  // --- Community Post Functions ---
  const handleCreatePost = async () => {
    if (!myKey || !formData.name) {
      showNotice("পোস্ট করতে আগে আপনার প্রোফাইল ফিলআপ করুন!", "warning");
      setActiveTab("profile");
      return;
    }
    if (!newPostText.trim() && !newPostImg) {
       showNotice("কিছু লিখুন বা ছবি দিন", "warning");
       return;
    }
    try {
      const newRef = push(ref(database, 'posts/'));
      await set(newRef, {
        text: newPostText,
        image: newPostImg || null,
        authorKey: myKey,
        authorName: formData.name,
        authorPhone: formData.phone || "guest",
        authorImg: formData.profileImg || null,
        timestamp: Date.now(),
      });
      setNewPostText("");
      setNewPostImg(null);
      showNotice("আপনার পোস্ট পাবলিশ হয়েছে!", "success");
    } catch(e) {
      showNotice("পোস্ট করতে সমস্যা হয়েছে", "warning");
    }
  };

  const handleDeletePost = async (postKey: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "পোস্টটি মুছে ফেলতে চান?",
      onConfirm: async () => {
        try {
          await remove(ref(database, `posts/${postKey}`));
          showNotice("পোস্টটি মুছে ফেলা হয়েছে", "success");
        } catch (e) {
          showNotice("ডিলিট করতে সমস্যা হয়েছে", "warning");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleDeleteComment = async (postKey: string, commentKey: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "কমেন্টটি মুছে ফেলতে চান?",
      onConfirm: async () => {
        try {
          await remove(ref(database, `posts/${postKey}/comments/${commentKey}`));
          showNotice("কমেন্ট মুছে ফেলা হয়েছে", "success");
        } catch (e) {
          showNotice("ডিলিট করতে সমস্যা হয়েছে", "warning");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleToggleLike = async (postKey: string) => {
     if (!myKey || !formData.name) {
        showNotice("লাইক দিতে আগে প্রোফাইল ফিলআপ করুন!", "warning");
        return;
     }
     const postRef = ref(database, `posts/${postKey}/likes/${myKey}`);
     try {
       const snap = await get(postRef);
       if (snap.exists() && snap.val() === true) {
         await remove(postRef);
       } else {
         await set(postRef, true);
       }
     } catch (e) {
       console.error("Like error", e);
     }
  };

  const handleSubmitComment = async (postKey: string) => {
    if (!myKey || !formData.name) {
      showNotice("কমেন্ট করতে আগে প্রোফাইল ফিলআপ করুন!", "warning");
      return;
    }
    if (!commentText.trim()) return;
    try {
      const newCommentRef = push(ref(database, `posts/${postKey}/comments/`));
      await set(newCommentRef, {
        authorKey: myKey,
        authorName: formData.name,
        authorPhone: formData.phone || "guest",
        authorImg: formData.profileImg || null,
        text: commentText,
        timestamp: Date.now()
      });
      setCommentText("");
      showNotice("আপনার কমেন্ট যুক্ত হয়েছে", "success");
    } catch (e) {
      showNotice("কমেন্ট করতে সমস্যা হয়েছে", "warning");
    }
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (adminEmail === appSettings.adminEmail && adminPin === appSettings.adminPin) {
      setIsAdmin(true);
      showNotice("অ্যাডমিন প্যানেলে স্বাগতম", "success");
    } else {
      showNotice("ভুল ইমেইল বা পিন", "warning");
    }
  };

  const handleAdminLogout = async () => {
    setIsAdmin(false);
    setAdminEmail("");
    setAdminPin("");
    showNotice("লগআউট সফল", "success");
  };

  const handleSaveSettings = async () => {
    try {
      await set(ref(database, 'settings/'), appSettings);
      showNotice("সেটিংস সেভ হয়েছে", "success");
    } catch(e) {
      showNotice("সেটিংস সেভ করতে সমস্যা হয়েছে", "warning");
    }
  };

  const handleSendChatMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim() && !chatImage) return;

    let senderKey = myKey;
    let senderName = formData.name;
    let senderPhone = formData.phone;

    if (!myKey) {
      if (!guestName) {
        setIsGuestNameModalOpen(true);
        return;
      }
      senderKey = "guest-" + guestName.replace(/\s+/g, '-').toLowerCase();
      senderName = guestName + " (Guest)";
      senderPhone = "guest";
    } else {
      const myProfile = donors.find(d => d.key === myKey);
      if (myProfile) {
        senderName = myProfile.name;
        senderPhone = myProfile.phone;
      }
    }

    try {
      await push(ref(database, 'chat/'), {
        senderKey,
        senderName,
        senderPhone,
        text: newChatMessage,
        image: chatImage || null,
        replyToKey: replyingTo?.key || null,
        replyToName: replyingTo?.senderName || null,
        replyToText: replyingTo?.text || null,
        timestamp: Date.now()
      });
      setNewChatMessage("");
      setChatImage(null);
      setReplyingTo(null);
    } catch(e) {
      showNotice("মেসেজ পাঠাতে সমস্যা হয়েছে", "warning");
    }
  };

  const handleSaveGuestName = (e: FormEvent) => {
    e.preventDefault();
    if (guestName.trim().length < 2) {
      showNotice("অনুগ্রহ করে সঠিক নাম দিন", "warning");
      return;
    }
    localStorage.setItem("myGuestName", guestName.trim());
    setIsGuestNameModalOpen(false);
    showNotice("এখন আপনি মেসেজ পাঠাতে পারেন!", "success");
  };

  const handleChatImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 0.3);
        setChatImage(compressed);
      } catch (err) {
        showNotice("ছবি প্রসেস করতে সমস্যা হয়েছে", "warning");
      }
    }
  };

  const handleBanUser = async (userKey: string, ban: boolean) => {
    setConfirmDialog({
      isOpen: true,
      message: ban ? "অ্যাকাউন্ট ব্যান করতে চান?" : "ব্যান তুলে নিতে চান?",
      onConfirm: async () => {
         try {
           await set(ref(database, `donors/${userKey}/banned`), ban);
           showNotice(ban ? "ইউজার ব্যান করা হয়েছে" : "ব্যান তুলে নেওয়া হয়েছে", "success");
         } catch (e) {
           showNotice("সমস্যা হয়েছে", "warning");
         }
         setConfirmDialog(null);
      }
    });
  };

  const handleDeleteUserGlobal = async (userKey: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "এই অ্যাকাউন্টটি সম্পূর্ণ ডিলিট করতে চান?",
      onConfirm: async () => {
         try {
           await remove(ref(database, `donors/${userKey}`));
           showNotice("অ্যাকাউন্ট মুছে ফেলা হয়েছে", "success");
         } catch (e) {
           showNotice("ডিলিট করতে সমস্যা হয়েছে", "warning");
         }
         setConfirmDialog(null);
      }
    });
  };

  const handleDeleteReport = async (reportKey: string) => {
     try {
       await remove(ref(database, `reports/${reportKey}`));
       showNotice("রিপোর্ট মুছে ফেলা হয়েছে", "success");
     } catch (e) {
       showNotice("সমস্যা হয়েছে", "warning");
     }
  };

  const submitReport = async () => {
    if (!reportModal?.donorKey) return;
    if (!reportReason.trim()) {
      showNotice("রিপোর্টের কারণ লিখুন", "warning");
      return;
    }
    try {
      await push(ref(database, 'reports/'), {
        reportedKey: reportModal.donorKey,
        reporterKey: myKey || "guest",
        reason: reportReason,
        timestamp: Date.now()
      });
      setReportModal(null);
      setReportReason("");
      showNotice("রিপোর্ট জমার জন্য ধন্যবাদ। আমরা বিষয়টি দেখছি।", "success");
    } catch(e) {
      showNotice("সমস্যা হয়েছে", "warning");
    }
  };

  const handleRecovery = () => {
    if (!recoveryPhone.trim()) {
      showNotice("ফোন নম্বর দিন", "warning");
      return;
    }
    const target = cleanPhone(recoveryPhone);
    const foundActive = donors.find(d => cleanPhone(d.phone) === target);
    const foundArchived = archivedDonors.find(d => cleanPhone(d.phone) === target);
    const found = foundActive || foundArchived;

    if (!found) {
      showNotice("এই নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সঠিক নম্বর দিন (যেমন: 017...)।", "warning");
      return;
    }
    if (found.banned) {
      showNotice("আপনার অ্যাকাউন্টটি ব্যান করা হয়েছে। অনুগ্রহ করে কর্তৃপক্ষের সাথে যোগাযোগ করুন।", "warning");
      return;
    }

    // Auto OTP Recovery Logic
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setConfirmDialog({
      isOpen: true,
      message: "অ্যাকাউন্ট রিকভারি করতে চান? আপনার ওটিপি (OTP) সরাসরি নোটিশ বোর্ডে পাঠানো হবে।",
      onConfirm: async () => {
        try {
          // 1. Create approved request
          await set(ref(database, `recovery_requests/${target}`), {
            phone: target,
            status: "approved",
            otp: otp,
            timestamp: Date.now()
          });

          // 2. Push to notices
          await push(ref(database, 'notices/'), {
            title: `রিকভারি ওটিপি (ফোন: ${target.slice(-4)}...)`,
            text: `নতুন ওটিপি অনুরোধ করা হয়েছে। আপনার ৪-সংখ্যার কোড হলো: ${otp}`,
            timestamp: Date.now()
          });

          // 3. Prompt SMS
          const smsLink = `sms:${target}?body=Your OTP for Blood Donor App is: ${otp}`;
          if (window.confirm(`ওটিপি জেনারেট হয়েছে: ${otp}\nএখনই কি ফোনে এসএমএস পাঠাতে চান?`)) {
            window.location.href = smsLink;
          }

          setWaitingForOtp(true);
          showNotice("ওটিপি সফলভাবে পাঠানো হয়েছে! নোটিশ কার্ড বা এসএমএস চেক করুন।", "success");
        } catch (e) {
          showNotice("অনুরোধ ব্যর্থ হয়েছে", "warning");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleVerifyOtp = async () => {
    const req = recoveryRequests.find(r => r.phone === recoveryPhone);
    if (!req || req.status !== "approved") {
      showNotice("অ্যাডমিন এখনও অনুরোধ মঞ্জুর করেননি", "warning");
      return;
    }
    if (recoveryOtpInput === req.otp) {
      const target = cleanPhone(recoveryPhone);
      const foundActive = donors.find(d => cleanPhone(d.phone) === target);
      const foundArchived = archivedDonors.find(d => cleanPhone(d.phone) === target);
      const found = foundActive || foundArchived;

      if (found) {
        if (!foundActive && foundArchived) {
          // Restore to active donors collection
          await set(ref(database, `donors/${foundArchived.key}`), foundArchived);
        }
        setMyKey(found.key);
        localStorage.setItem('myDonorKey', found.key);
        setFormData(found);
        showNotice("অ্যাকাউন্ট রিকভার সফল হয়েছে!", "success");
        setWaitingForOtp(false);
        setRecoveryOtpInput("");
        setRecoveryPhone("");
        setActiveTab("profile");
        // Clear request
        remove(ref(database, `recovery_requests/${recoveryPhone}`));
      }
    } else {
      showNotice("ভুল ওটিপি (OTP)", "warning");
    }
  };

  const handleSendNotice = async () => {
    if (!newNotice.title.trim() || !newNotice.text.trim()) {
      showNotice("টাইটেল ও বর্ণনা দিন", "warning");
      return;
    }
    try {
      await push(ref(database, 'notices/'), {
        ...newNotice,
        timestamp: Date.now()
      });
      setNewNotice({ title: "", text: "" });
      showNotice("সবার জন্য নোটিশ পাঠানো হয়েছে!", "success");
    } catch (e) {
      showNotice("নোটিশ পাঠাতে সমস্যা হয়েছে", "warning");
    }
  };

  const handleDeleteNotice = async (key: string) => {
    setConfirmDialog({
      isOpen: true,
      message: "নোটিশটি মুছে ফেলতে চান?",
      onConfirm: async () => {
        await remove(ref(database, `notices/${key}`));
        showNotice("নোটিশ মুছে ফেলা হয়েছে", "success");
        setConfirmDialog(null);
      }
    });
  };

  const handleApproveRecovery = async (phone: string) => {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      await update(ref(database, `recovery_requests/${phone}`), {
        status: "approved",
        otp: otp
      });
      
      // Push OTP to Notice Box as requested
      await push(ref(database, 'notices/'), {
        title: `রিকভারি ওটিপি (ফোন: ${phone.slice(-4)}...)`,
        text: `আপনার রিকভারি ওটিপি হলো: ${otp}`,
        timestamp: Date.now()
      });

      showNotice(`অনুরোধ মঞ্জুর হয়েছে। ওটিপি: ${otp}`, "success");
      
      // Auto SMS logic (Prompt admin to send)
      const smsLink = `sms:${phone}?body=Your OTP for Blood Donor App is: ${otp}`;
      if (window.confirm(`অনুরোধ মঞ্জুর হয়েছে। ওটিপি: ${otp}\nএখনই কি ব্যবহারকারীকে এসএমএস পাঠাতে চান?`)) {
        window.location.href = smsLink;
      }
    } catch (e) {
      showNotice("সমস্যা হয়েছে", "warning");
    }
  };

  const getRelativeTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "কিছুক্ষণ আগে";
    if (diff < 3600) return `${Math.floor(diff / 60)} মিনিট আগে`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ঘণ্টা আগে`;
    return `${Math.floor(diff / 86400)} দিন আগে`;
  };

  // Filtering Logic
  const filteredDonors = donors.filter(d => {
    if (d.banned) return false;
    if (filter === "fav" && !favorites.includes(d.key)) return false;
    if (filter !== "all" && filter !== "fav" && d.canDonate !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (d.name||"").toLowerCase().includes(q) || 
                    (d.blood||"").toLowerCase().includes(q) || 
                    (d.loc||"").toLowerCase().includes(q) ||
                    (d.phone||"").includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalCount = donors.length;
  const onlineCount = donors.filter(d => d.canDonate === "হ্যাঁ").length;
  const offlineCount = donors.filter(d => d.canDonate === "না").length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-red-200 flex flex-col overflow-x-hidden md:pb-0 pb-20">
      
      {/* Integrated Download Notice */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white relative z-40 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Smartphone className="w-4 h-4 animate-pulse" />
            রক্তদান সেবাকে আরও সহজ ও দ্রুত করতে আমাদের অফিসিয়াল অ্যাপটি ডাউনলোড করুন!
          </div>
          <div className="flex gap-2">
             <button onClick={copyShareLink} className="bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-colors">
               <Share2 className="w-3 h-3" /> লিংক কপি 
             </button>
             <a href="https://www.mediafire.com/file/n89knndg1p9zxbb/_Blood_Donor_Online_19784143.apk/file" target="_blank" rel="noreferrer" className="bg-white text-red-700 px-3 py-1 text-xs font-bold rounded flex items-center gap-1 hover:bg-red-50 transition-colors shadow-sm">
               <Download className="w-3 h-3" /> APK डाउनलोड
             </a>
          </div>
        </div>
      </div>

      {/* Professional Header */}
      {appSettings.showBanner && appSettings.bannerText && (
         <div className="bg-indigo-600 text-white text-center py-2 px-4 text-sm font-bold flex justify-center items-center gap-2">
            <BellRing className="w-4 h-4" /> {appSettings.bannerText}
         </div>
      )}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => {
              setActiveTab("feed");
              const newClicks = logoClicks + 1;
              setLogoClicks(newClicks);
              if (newClicks >= 10) {
                 setActiveTab("admin");
                 setLogoClicks(0);
              }
            }}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
              <Droplet className="w-5 h-5 text-white fill-current" />
            </div>
            <div>
               <h1 className="text-lg font-extrabold text-slate-900 leading-tight uppercase tracking-tight">Blood Web</h1>
               <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Live Server</p>
               </div>
            </div>
          </motion.div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setActiveTab("feed")}
              className={`px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'feed' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Home className="w-4 h-4" /> ফিড
            </button>
            <button
              onClick={() => setActiveTab("community")}
              className={`px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'community' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}
            >
              <MessageSquare className="w-4 h-4" /> পোস্ট
            </button>
            {appSettings.chatEnabled && (
               <button
                 onClick={() => setActiveTab("chat")}
                 className={`px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-50'}`}
               >
                 <MessageCircle className="w-4 h-4" /> চ্যাট
               </button>
            )}
            <button
              onClick={() => setIsSupportModalOpen(true)}
              className="px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100"
            >
              <HeartHandshake className="w-4 h-4" /> সাপোর্ট করুন
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-5 py-2 rounded-full font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'profile' ? 'bg-red-50 text-red-700 shadow-sm border border-red-100' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
            >
              <User className="w-4 h-4" /> আমার প্রোফাইল
            </button>
          </nav>

          {/* User Preview / Download App Mobile / Search */}
          <div className="flex items-center gap-2 flex-1 justify-end">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setIsNoticeModalOpen(true);
                    const latestTs = notices.length > 0 ? Math.max(...notices.map(n => n.timestamp)) : 0;
                    setLastSeenNoticeTimestamp(latestTs);
                    localStorage.setItem("lastSeenNoticeTimestamp", latestTs.toString());
                  }}
                  className="relative w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-500 transition-all hover:bg-white hover:shadow-md active:scale-90"
                >
                   <Bell className="w-5 h-5" />
                   {unreadNoticesCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                         {unreadNoticesCount}
                      </span>
                   )}
                </button>
                <button 
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (activeTab !== "feed") setActiveTab("feed");
                  }} 
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 ${isSearchOpen ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:bg-white hover:shadow-md'}`}
                >
                   {isSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                </button>
                <button 
                   onClick={() => setIsPwaModalOpen(true)}
                   className="md:hidden w-9 h-9 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform ml-1"
                >
                   <Download className="w-4 h-4" />
                </button>
             </div>
             <div 
               onClick={() => setActiveTab("profile")}
               className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-full border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
             >
                <div className="hidden sm:block text-right pr-1">
                   <h2 className="text-xs font-bold text-slate-800 leading-tight">{myKey && formData.name ? formData.name.split(' ')[0] : 'অ্যাকাউন্ট'}</h2>
                   <span className="text-[9px] text-red-600 font-bold leading-tight">{myKey ? 'ভিউ প্রোফাইল' : 'নতুন করুন'}</span>
                </div>
                <img 
                   src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${myKey && formData.phone ? formData.phone : 'guest'}`} 
                   className={`w-8 h-8 rounded-full border-2 bg-white object-cover ${myKey ? 'border-red-500' : 'border-slate-300'}`} 
                   alt="Avatar"
                />
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
         <AnimatePresence mode="wait">
            
            {/* --- FEED TAB --- */}
            {activeTab === "feed" && (
               <motion.div 
                  key="feed"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
               >
                  {/* Stats / Search Switcher Area */}
                  <div className="relative min-h-[80px]">
                    <AnimatePresence mode="wait">
                      {isSearchOpen ? (
                        <motion.div 
                          key="search-box"
                          initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                          animate={{ opacity: 1, y: 0, scale: 1 }} 
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="bg-white rounded-2xl border-2 border-red-100 shadow-xl p-2"
                        >
                           <div className="relative flex items-center gap-3 pr-2">
                              <div className="w-10 h-10 flex items-center justify-center text-red-500 shrink-0">
                                 <Search className="w-5 h-5" />
                              </div>
                              <input 
                                 autoFocus
                                 type="text"
                                 placeholder="নাম, রক্ত বা এলাকা লিখে সার্চ করুন..."
                                 value={searchQuery}
                                 onChange={(e) => setSearchQuery(e.target.value)}
                                 className="flex-1 bg-transparent border-none outline-none text-slate-800 font-bold placeholder:text-slate-400 py-3"
                              />
                              <button 
                                 onClick={() => {
                                    setIsSearchOpen(false);
                                    setSearchQuery("");
                                  }}
                                 className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              >
                                 <X className="w-4 h-4" />
                              </button>
                           </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="stats-cards"
                          initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                          animate={{ opacity: 1, y: 0, scale: 1 }} 
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          className="grid grid-cols-3 gap-2 sm:gap-3"
                        >
                           <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center relative">
                              <span className="text-xl sm:text-2xl font-extrabold text-slate-800">{totalCount}</span>
                              <span className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1 uppercase">মোট ডোনার</span>
                           </div>
                           <div className="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-50 rounded-bl-full"></div>
                              <span className="text-xl sm:text-2xl font-extrabold text-emerald-600">{onlineCount}</span>
                              <span className="text-[10px] sm:text-xs font-bold text-emerald-600/80 mt-1 uppercase">অ্যাক্টিভ</span>
                           </div>
                           <div className="bg-white p-3 sm:p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
                              <div className="absolute bottom-0 left-0 w-8 h-8 bg-rose-50 rounded-tr-full"></div>
                              <span className="text-xl sm:text-2xl font-extrabold text-rose-500">{offlineCount}</span>
                              <span className="text-[10px] sm:text-xs font-bold text-rose-500/80 mt-1 uppercase">অফলাইন</span>
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
                     {[
                        { id: 'all', label: 'সব পোস্ট' },
                        { id: 'হ্যাঁ', label: 'সক্রিয় লিস্ট' },
                        { id: 'না', label: 'অফলাইন লিস্ট' },
                        { id: 'fav', label: 'ফেভারিট' }
                     ].map(f => (
                        <button
                           key={f.id}
                           onClick={() => setFilter(f.id as any)}
                           className={`snap-center flex-shrink-0 px-5 py-2 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors border shadow-sm ${filter === f.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                        >
                           {f.label}
                        </button>
                     ))}
                  </div>

                  {/* Donor List Grid */}
                  {filteredDonors.length === 0 ? (
                     <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center shadow-sm">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <Search className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">কোনো ডোনার পাওয়া যায়নি</h3>
                        <p className="text-sm text-slate-500">আপনার নিজস্ব একটি প্রোফাইল খুলে অন্যকে সাহায্য করুন!</p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                        {filteredDonors.map((donor) => (
                           <motion.div 
                              layout
                              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                              key={donor.key}
                              className="bg-white rounded-[20px] p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group"
                           >
                              {/* Favorite Heart */}
                              <button 
                                 onClick={() => toggleFav(donor.key)}
                                 className="absolute top-5 left-5 z-10 w-8 h-8 bg-slate-50 hover:bg-red-50 rounded-full flex items-center justify-center transition-colors"
                              >
                                 <Heart className={`w-4 h-4 ${favorites.includes(donor.key) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                              </button>

                              {/* Card Header */}
                              <div className="flex justify-between items-start pl-10 mb-4">
                                 <div className="flex gap-3">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${donor.phone}`} className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50" />
                                    <div>
                                       <button onClick={() => setActiveDonorModal(donor)} className="font-bold text-slate-800 flex items-center gap-1 text-[15px] hover:text-red-600 transition-colors">
                                          {donor.name} {donor.followers && donor.followers > 5 && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                                       </button>
                                       <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3"/> {donor.loc}</p>
                                    </div>
                                 </div>
                                 <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg flex flex-col items-center shadow-sm">
                                    <span className="font-black text-sm leading-none">{donor.blood}</span>
                                    {donor.type && <span className="text-[8px] uppercase tracking-wider font-bold mb-0.5">{donor.type.substring(0,3)}</span>}
                                 </div>
                              </div>

                              {/* Status & Social */}
                              <div className="flex items-center justify-between mb-4">
                                 <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold inline-flex items-center gap-1 border ${donor.canDonate === "হ্যাঁ" ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${donor.canDonate === "হ্যাঁ" ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    {donor.canDonate === "হ্যাঁ" ? 'রক্ত দানে প্রস্তুত' : 'সাময়িক অফলাইন'}
                                 </div>
                                 <div className="flex gap-1.5">
                                    {donor.fb && <a href={donor.fb} target="_blank" rel="noreferrer" className="w-7 h-7 bg-[#1877F2]/10 text-[#1877F2] rounded-full flex items-center justify-center hover:bg-[#1877F2] hover:text-white transition-colors"><User className="w-3.5 h-3.5" /></a>}
                                    {donor.wa && <a href={`https://wa.me/${donor.wa}`} target="_blank" rel="noreferrer" className="w-7 h-7 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-colors"><Activity className="w-3.5 h-3.5" /></a>}
                                 </div>
                              </div>

                              {/* Info Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs font-medium bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4">
                                 <div className="flex justify-between"><span className="text-slate-500">ওজন</span> <span className="text-slate-800">{donor.weight || '-'}</span></div>
                                 <div className="flex justify-between"><span className="text-slate-500">মোট দান</span> <span className="text-slate-800">{donor.times || '0'} বার</span></div>
                                 <div className="flex justify-between col-span-2"><span className="text-slate-500">শেষ দান</span> <span className="text-slate-800">{donor.last || 'জানা নেই'}</span></div>
                              </div>
                              
                              {donor.bio && <p className="text-xs text-slate-600 mb-4 px-1 line-clamp-2 leading-relaxed">"{donor.bio}"</p>}

                              {/* Reviews Line */}
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-4 px-2 cursor-pointer border-t border-slate-100 pt-3" onClick={() => giveRating(donor.key)}>
                                 <div className="flex gap-0.5 text-amber-400">
                                    <Star className="w-3.5 h-3.5 fill-current" /><Star className="w-3.5 h-3.5 fill-current" /><Star className="w-3.5 h-3.5 fill-current" /><Star className="w-3.5 h-3.5 fill-current" /><Star className="w-3.5 h-3.5 fill-current opacity-30" />
                                 </div>
                                 <span>{donor.rating || 80}% আস্থা • {donor.followers || 0} ফলোয়ার</span>
                              </div>

                              {/* Action Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                 <button onClick={() => incrementFollowers(donor.key)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors">
                                    <UserPlus className="w-3.5 h-3.5" /> ফলো করুন
                                 </button>
                                 <a href={`tel:${donor.phone}`} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm">
                                    <Phone className="w-3.5 h-3.5" /> কল করুন
                                 </a>
                                 {myKey === donor.key && (
                                    <button onClick={deleteProfile} className="col-span-2 mt-1 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors">
                                       <Trash2 className="w-3.5 h-3.5" /> আমার প্রোফাইল মুছুন
                                    </button>
                                 )}
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  )}
               </motion.div>
            )}

            {/* --- PROFILE / REGISTRATION TAB --- */}
            {activeTab === "profile" && (
               <motion.div 
                  key="profile"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                  className="max-w-xl mx-auto space-y-6"
               >
                  <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                     <div className="text-center mb-8">
                        <label className="relative cursor-pointer w-24 h-24 mx-auto mb-4 block group">
                           {formData.profileImg ? (
                             <img src={formData.profileImg} className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 shadow-sm" alt="Profile" />
                           ) : (
                             <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-slate-100 group-hover:bg-red-100 transition-colors">
                               <Camera className="w-8 h-8" />
                             </div>
                           )}
                           <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Camera className="w-6 h-6 text-white" />
                           </div>
                           <input 
                             type="file" 
                             accept="image/*" 
                             className="hidden" 
                             onChange={async (e) => {
                               const file = e.target.files?.[0];
                               if (file) {
                                 try {
                                   const base64 = await compressImage(file, 0.5);
                                   setFormData(f => ({ ...f, profileImg: base64 }));
                                 } catch (err) {
                                   showNotice("ছবি আপলোডে সমস্যা হয়েছে", "warning");
                                 }
                               }
                             }}
                           />
                        </label>
                        <h2 className="text-2xl font-bold text-slate-900">{myKey ? 'প্রোফাইল আপডেট করুন' : 'ডোনার যুক্ত হোন'}</h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">একটি ফোন থেকে একটি অ্যাকাউন্ট করা যাবে</p>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">পূর্ণ নাম</label>
                           <input type="text" placeholder="যেমন: রাকিবুল ইসলাম" value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm" />
                        </div>
                        
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">রক্তের গ্রুপ</label>
                           <select value={formData.blood} onChange={e => setFormData(f => ({...f, blood: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm appearance-none font-medium">
                              <option value="">নির্বাচন করুন</option>
                              <option value="A+">A+</option><option value="A-">A-</option>
                              <option value="B+">B+</option><option value="B-">B-</option>
                              <option value="O+">O+</option><option value="O-">O-</option>
                              <option value="AB+">AB+</option><option value="AB-">AB-</option>
                           </select>
                        </div>

                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">রক্তের ধরন</label>
                           <select value={formData.type} onChange={e => setFormData(f => ({...f, type: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm font-medium">
                              <option value="">নির্বাচন করুন</option>
                              <option value="Positive">Positive (+)</option>
                              <option value="Negative">Negative (-)</option>
                           </select>
                        </div>

                        <div className="sm:col-span-2">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">বর্তমান ঠিকানা (সংক্ষিপ্ত)</label>
                           <input type="text" placeholder="যেমন: মিরপুর ১০, ঢাকা" value={formData.loc} onChange={e => setFormData(f => ({...f, loc: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm" />
                        </div>

                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">মোবাইল নম্বর <span className="text-red-500">*</span></label>
                           <input type="tel" placeholder="017XXXXXXXX" value={formData.phone} onChange={e => setFormData(f => ({...f, phone: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm font-medium" />
                        </div>

                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">আপনার ওজন</label>
                           <input type="text" placeholder="যেমন: ৬৫ কেজি" value={formData.weight} onChange={e => setFormData(f => ({...f, weight: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm" />
                        </div>

                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">শেষবার রক্তদান</label>
                           <input type="text" placeholder="যেমন: ৩ মাস আগে" value={formData.last} onChange={e => setFormData(f => ({...f, last: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm" />
                        </div>

                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">মোট কতবার দিয়েছেন?</label>
                           <input type="text" placeholder="যেমন: ৪ বার" value={formData.times} onChange={e => setFormData(f => ({...f, times: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm" />
                        </div>

                        <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                           <label className="block text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                              <Activity className="w-4 h-4 text-emerald-500" />
                              আপনি কি এখন রক্ত দিতে পারবেন?
                           </label>
                           <div className="flex gap-4">
                              <label className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg cursor-pointer transition-all ${formData.canDonate === 'হ্যাঁ' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>
                                 <input type="radio" name="status" value="হ্যাঁ" checked={formData.canDonate === "হ্যাঁ"} onChange={e => setFormData(f => ({...f, canDonate: e.target.value}))} className="hidden" />
                                 <CheckCircle2 className={`w-4 h-4 ${formData.canDonate === 'হ্যাঁ' ? 'block' : 'hidden'}`} /> হ্যাঁ, প্রস্তুত
                              </label>
                              <label className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg cursor-pointer transition-all ${formData.canDonate === 'না' ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}>
                                 <input type="radio" name="status" value="না" checked={formData.canDonate === "না"} onChange={e => setFormData(f => ({...f, canDonate: e.target.value}))} className="hidden" />
                                 <X className={`w-4 h-4 ${formData.canDonate === 'না' ? 'block' : 'hidden'}`} /> না, অফলাইন
                              </label>
                           </div>
                        </div>

                        <div className="sm:col-span-2">
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">বায়ো / মন্তব্য</label>
                           <textarea rows={2} placeholder="নিজের সম্পর্কে সংক্ষেপে কিছু লিখুন..." value={formData.bio} onChange={e => setFormData(f => ({...f, bio: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-sm resize-none"></textarea>
                        </div>
                     </div>

                     <div className="mt-8">
                        <button 
                           onClick={saveProfile}
                           disabled={isSubmitting || (!appSettings.allowGlobalEdit && !!myKey)}
                           className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                        >
                           {isSubmitting ? (
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           ) : myKey ? (
                              !appSettings.allowGlobalEdit ? <><ShieldAlert className="w-5 h-5"/> এডিট অফ করা আছে</> : <><Edit3 className="w-5 h-5"/> প্রোফাইল আপডেট করুন</>
                           ) : <><Upload className="w-5 h-5"/> প্রোফাইল পাবলিক করুন</>}
                        </button>
                        {myKey && (
                           <button onClick={deleteProfile} className="w-full mt-4 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                              <Trash2 className="w-4 h-4"/> অ্যাকাউন্ট মুছে ফেলুন
                           </button>
                        )}
                     </div>
                  </div>
                  
                  {/* Account Options */}
                  <div className="flex justify-center flex-wrap gap-4 mt-8 pb-8 text-sm font-medium text-slate-500">
                     {!myKey && (
                       <button onClick={() => setActiveTab("recovery")} className="hover:text-indigo-600 transition-colors underline underline-offset-4">পুনরায় লগইন (রিকভারি)</button>
                     )}
                  </div>
               </motion.div>
            )}

            {/* --- COMMUNITY TAB --- */}
            {activeTab === "community" && (
               <motion.div 
                  key="community"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 max-w-3xl mx-auto"
               >
                  {/* Create Post Banner */}
                  <div className="bg-white rounded-[20px] p-5 border border-slate-200 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                     <div className="flex gap-3 mb-3">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${myKey ? formData.phone : 'guest'}`} className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50" />
                        <textarea 
                           placeholder="জরুরী রক্তের প্রয়োজন বা রক্তদানের অভিজ্ঞতা শেয়ার করুন..." 
                           value={newPostText}
                           onChange={e => setNewPostText(e.target.value)}
                           className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm resize-none min-h-[80px]"
                        ></textarea>
                     </div>
                     <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                        <label className="cursor-pointer text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-lg hover:bg-indigo-50">
                           <ImageIcon className="w-5 h-5" /> ছবি দিন
                           <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const base64 = await compressImage(file, 0.6);
                                    setNewPostImg(base64);
                                  } catch (err) {
                                    showNotice("ছবি আপলোডে সমস্যা", "warning");
                                  }
                                }
                              }}
                           />
                        </label>
                        <button 
                           onClick={handleCreatePost}
                           className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm"
                        >
                           <MessageSquare className="w-4 h-4" /> পোস্ট করুন
                        </button>
                     </div>
                     {newPostImg && (
                       <div className="mt-3 relative inline-block">
                         <img src={newPostImg} className="h-20 rounded-lg object-cover border border-slate-200" alt="Preview"/>
                         <button onClick={() => setNewPostImg(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600">
                           <X className="w-3 h-3" />
                         </button>
                       </div>
                     )}
                  </div>

                  {/* Posts List */}
                  <div className="space-y-4">
                     {(() => {
                        const filteredPosts = posts.filter(p => 
                           !searchQuery || 
                           p.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.authorName.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        if (filteredPosts.length === 0) {
                           return (
                              <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center shadow-sm">
                                 <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                 <p className="text-slate-500 font-medium">
                                    {searchQuery ? "আপনার সার্চ অনুযায়ী কোনো পোস্ট পাওয়া যায়নি" : "কোনো পোস্ট এখনও পাওয়া যায়নি। প্রথম পোস্টটি আপনিই করুন!"}
                                 </p>
                              </div>
                           );
                        }
                        return filteredPosts.map(post => {
                           const isLiked = myKey ? !!post.likes?.[myKey] : false;
                           const likesCount = post.likes ? Object.keys(post.likes).length : 0;
                           const commentsList = post.comments ? Object.keys(post.comments).map(k => ({ key: k, ...post.comments![k] })).sort((a,b) => a.timestamp - b.timestamp) : [];
                           const isCommenting = activePostIdForComment === post.key;
                           const showMenu = activeMenuPostId === post.key;

                           return (
                              <div key={post.key} className="bg-white rounded-[20px] p-5 sm:p-6 border border-slate-200 shadow-sm relative transition-all hover:shadow-md">
                               {/* Parent Post */}
                              <div className="flex gap-3 mb-3 relative">
                                 <button 
                                   onClick={() => {
                                     const d = donors.find(x => x.key === post.authorKey);
                                     if(d) setActiveDonorModal(d);
                                     else setActiveDonorModal({ name: post.authorName, phone: post.authorPhone, profileImg: post.authorImg, blood: "N/A", loc: "N/A" } as any);
                                   }}
                                   className="shrink-0 hover:opacity-80 transition-opacity"
                                 >
                                    <img src={post.authorImg || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorPhone}`} className="w-12 h-12 rounded-full border border-slate-200 bg-slate-50 object-cover" />
                                 </button>
                                 <div className="flex-1">
                                    <button 
                                      onClick={() => {
                                        const d = donors.find(x => x.key === post.authorKey);
                                        if(d) setActiveDonorModal(d);
                                        else setActiveDonorModal({ name: post.authorName, phone: post.authorPhone, profileImg: post.authorImg, blood: "N/A", loc: "N/A" } as any);
                                      }}
                                      className="text-left hover:text-red-600 transition-colors"
                                    >
                                      <h3 className="font-bold text-slate-800 text-[15px]">{post.authorName}</h3>
                                    </button>
                                    <p className="text-[11px] text-slate-500 font-medium">{getRelativeTime(post.timestamp)}</p>
                                 </div>
                                 <button onClick={() => setActiveMenuPostId(showMenu ? null : post.key)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                                    <MoreHorizontal className="w-5 h-5" />
                                 </button>
                                 {showMenu && (
                                    <div className="absolute top-10 right-0 bg-white border border-slate-200 shadow-lg rounded-xl py-1 z-10 w-40 overflow-hidden">
                                       <button onClick={() => { setActiveMenuPostId(null); const d = donors.find(x => x.key === post.authorKey); if(d) setActiveDonorModal(d); else showNotice("ডোনার তথ্য পাওয়া যায়নি", "warning"); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                          <User className="w-4 h-4" /> ডোনার প্রোফাইল
                                       </button>
                                       <button onClick={() => { setActiveMenuPostId(null); setReportModal({ isOpen: true, donorKey: post.authorKey }); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4" /> রিপোর্ট করুন
                                       </button>
                                       {(myKey === post.authorKey || isAdmin) && (
                                         <button onClick={() => { setActiveMenuPostId(null); handleDeletePost(post.key); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" /> ডিলিট করুন
                                         </button>
                                       )}
                                    </div>
                                 )}
                              </div>
                               <div className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap mb-4 px-1">
                                 {post.text.length > 200 && !expandedPosts[post.key] ? (
                                   <>
                                     {post.text.substring(0, 200)}...
                                     <button 
                                      onClick={() => setExpandedPosts(prev => ({...prev, [post.key]: true}))}
                                      className="text-indigo-600 font-bold ml-1 hover:underline"
                                     >
                                      more..
                                     </button>
                                   </>
                                 ) : (
                                   <>
                                     {post.text}
                                     {post.text.length > 200 && (
                                       <button 
                                        onClick={() => setExpandedPosts(prev => ({...prev, [post.key]: false}))}
                                        className="text-indigo-600 font-bold ml-1 hover:underline"
                                       >
                                        less
                                       </button>
                                     )}
                                   </>
                                 )}
                               </div>
                              {post.image && (
                                 <img src={post.image} className="w-full rounded-xl object-cover mb-4 border border-slate-100 max-h-96" alt="Post" />
                              )}
                              
                              <div className="flex items-center gap-4 text-[13px] font-bold text-slate-500 border-y border-slate-100 py-2.5 px-1 mb-2">
                                 <button onClick={() => handleToggleLike(post.key)} className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-indigo-600' : 'hover:text-indigo-600'}`}>
                                    <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-indigo-600' : ''}`} /> 
                                    {likesCount > 0 ? `${likesCount} লাইক` : 'লাইক'}
                                 </button>
                                 <button onClick={() => setActivePostIdForComment(isCommenting ? null : post.key)} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                                    <MessageCircle className="w-4 h-4" /> 
                                    {commentsList.length > 0 ? `${commentsList.length} কমেন্ট` : 'কমেন্ট করুন'}
                                 </button>
                                 <button className="flex items-center gap-1.5 ml-auto hover:text-slate-800 transition-colors" onClick={() => copyShareLink()}>
                                    <Share2 className="w-4 h-4" /> শেয়ার
                                 </button>
                              </div>

                              {/* Comments Section */}
                              {commentsList.length > 0 && (
                                 <div className="mt-3 space-y-3 px-1">
                                    {commentsList.map(comment => (
                                       <div key={comment.key} className="flex gap-2">
                                          <button onClick={() => {
                                             const d = donors.find(x => x.key === comment.authorKey);
                                             if(d) setActiveDonorModal(d);
                                             else setActiveDonorModal({ name: comment.authorName, phone: comment.authorPhone, profileImg: comment.authorImg, blood: "N/A", loc: "N/A" } as any);
                                           }} className="shrink-0 hover:opacity-80 transition-opacity">
                                             <img src={comment.authorImg || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorPhone}`} className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 object-cover" />
                                           </button>
                                          <div className="flex-1">
                                             <div className="bg-slate-50 inline-block rounded-2xl rounded-tl-none px-4 py-2 border border-slate-100">
                                                <div className="flex items-baseline gap-2 mb-0.5">
                                                   <button onClick={() => {
                                                      const d = donors.find(x => x.key === comment.authorKey);
                                                      if(d) setActiveDonorModal(d);
                                                      else setActiveDonorModal({ name: comment.authorName, phone: comment.authorPhone, profileImg: comment.authorImg, blood: "N/A", loc: "N/A" } as any);
                                                    }} className="hover:text-red-600 transition-colors">
                                                      <h4 className="font-bold text-slate-800 text-[13px]">{comment.authorName}</h4>
                                                    </button>
                                                   <span className="text-[9px] text-slate-400 font-medium">{getRelativeTime(comment.timestamp)}</span>
                                                </div>
                                                <p className="text-[12px] text-slate-600 leading-normal whitespace-pre-wrap">{comment.text}</p>
                                             </div>
                                             <div className="flex items-center gap-3 px-2 mt-1 text-[11px] font-bold text-slate-400">
                                                <button onClick={() => { setActivePostIdForComment(post.key); setCommentText(`@${comment.authorName} `); }} className="hover:text-indigo-600 transition-colors">রিপ্লাই</button>
                                                {(myKey === comment.authorKey || isAdmin) && (
                                                  <button onClick={() => handleDeleteComment(post.key, comment.key)} className="hover:text-red-500 transition-colors">ডিলিট</button>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              )}

                              {/* Add Comment Input */}
                              {isCommenting && (
                                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-2 mt-4 px-1">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${myKey ? formData.phone : 'guest'}`} className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 shrink-0" />
                                    <div className="relative flex-1">
                                       <input 
                                          type="text" 
                                          placeholder="কমেন্ট লিখুন..." 
                                          value={commentText}
                                          onChange={e => setCommentText(e.target.value)}
                                          onKeyDown={e => { if(e.key === 'Enter') handleSubmitComment(post.key) }}
                                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm pr-10"
                                       />
                                       <button onClick={() => handleSubmitComment(post.key)} className="absolute right-1 top-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center transition-colors">
                                          <Send className="w-3.5 h-3.5 ml-0.5" />
                                       </button>
                                    </div>
                                 </motion.div>
                              )}
                           </div>
                        );
                     });
                  })()}
               </div>
            </motion.div>
         )}

         {activeTab === "recovery" && (
             <motion.div 
               key="recovery"
               initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
               className="max-w-md mx-auto"
            >
               <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-slate-200 shadow-sm text-center">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Smartphone className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">অ্যাকাউন্ট রিকভারি</h2>
                  
                  {!waitingForOtp ? (
                     <>
                        <p className="text-slate-500 mb-6 text-sm">আপনার অ্যাকাউন্টের ফোন নম্বরটি দিন</p>
                        <input 
                           type="tel" 
                           placeholder="01XXXXXXXXX"
                           value={recoveryPhone}
                           onChange={(e) => setRecoveryPhone(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-center font-bold tracking-wider text-slate-800 mb-4"
                        />
                        <button onClick={handleRecovery} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm">
                           খুঁজুন এবং রিকভার করুন
                        </button>
                     </>
                  ) : (
                     <>
                        <p className="text-slate-500 mb-6 text-sm">অ্যাডমিন আপনার অনুরোধটি মঞ্জুর করলে "নোটিশ বোর্ড" এ ওটিপি (OTP) পাবেন। ওটিপি এখানে নিচের বক্সে লিখুন।</p>
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4 text-left">
                           <p className="text-xs text-indigo-600 font-bold mb-1">ফোন নম্বর:</p>
                           <p className="font-black text-indigo-900">{recoveryPhone}</p>
                        </div>
                        <input 
                           type="text" 
                           placeholder="ওটিপি (OTP) কোড"
                           value={recoveryOtpInput}
                           onChange={(e) => setRecoveryOtpInput(e.target.value)}
                           maxLength={4}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-center font-bold tracking-[10px] text-slate-800 mb-4 placeholder:tracking-normal"
                        />
                        <button onClick={handleVerifyOtp} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm mb-3">
                           ভেরিফাই এবং লগইন
                        </button>
                        <button onClick={() => setWaitingForOtp(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-lg">
                           নম্বর পরিবর্তন করুন
                        </button>
                     </>
                  )}
               </div>
            </motion.div>
         )}

         {activeTab === "chat" && (
            <motion.div 
               key="chat"
               initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
               className="max-w-2xl mx-auto flex flex-col h-[75vh] md:h-[65vh]"
            >
               <div className="bg-white rounded-t-[24px] border border-slate-200 border-b-0 p-4 shrink-0 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                     <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                     <h2 className="font-bold text-slate-800">পাবলিক গ্রুপ চ্যাট</h2>
                     <p className="text-xs text-slate-500 font-medium">{chatMessages.length} মেসেজ</p>
                  </div>
               </div>

               <div className="flex-1 bg-slate-50 border-l border-r border-slate-200 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map(msg => {
                     const myEffectiveKey = myKey || (guestName ? ("guest-" + guestName.trim().replace(/\s+/g, '-').toLowerCase()) : null);
                     const isMe = msg.senderKey === myEffectiveKey;
                     return (
                        <motion.div 
                          key={msg.key} 
                          drag="x"
                          dragConstraints={{ left: 0, right: 100 }}
                          dragSnapToOrigin={true}
                          dragElastic={{ left: 0, right: 0.2 }}
                          onDragEnd={(_, info) => {
                            if (info.offset.x > 80) {
                              setReplyingTo(msg);
                            }
                          }}
                          onPointerDown={(e) => {
                            const timer = setTimeout(() => {
                              if ('vibrate' in navigator) navigator.vibrate(50);
                              setLongPressMsg(msg);
                            }, 500);
                            (window as any).longPressTimer = timer;
                          }}
                          onPointerUp={() => clearTimeout((window as any).longPressTimer)}
                          onPointerLeave={() => clearTimeout((window as any).longPressTimer)}
                          onPointerCancel={() => clearTimeout((window as any).longPressTimer)}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`flex flex-col max-w-[85%] select-none group ${isMe ? 'items-end self-end ml-auto' : 'items-start'}`}
                        >
                           <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">{isMe ? "আপনি" : msg.senderName}</span>
                           <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <div className={`relative px-4 py-2.5 rounded-2xl text-[15px] ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'}`}>
                                 {msg.replyToKey && (
                                   <div className={`mb-2 p-2 rounded-lg text-[10px] border-l-2 ${isMe ? 'bg-indigo-700/40 border-indigo-200' : 'bg-slate-100 border-slate-300'} max-w-full overflow-hidden text-left`}>
                                      <p className="font-bold mb-0.5 flex items-center gap-1">
                                        <Reply className="w-2.5 h-2.5" /> {msg.replyToName}
                                      </p>
                                      <p className={`truncate italic ${isMe ? 'text-indigo-100' : 'text-slate-500'}`}>{msg.replyToText || "ছবি"}</p>
                                   </div>
                                 )}
                                 {msg.image && (
                                   <div className="mb-2 overflow-hidden rounded-lg">
                                      <img src={msg.image} alt="" className="max-w-full h-auto max-h-64 object-cover rounded-md" />
                                   </div>
                                 )}
                                 {msg.text && <p className="leading-relaxed break-words">{msg.text}</p>}
                              </div>
                              <button 
                                onClick={() => setReplyingTo(msg)}
                                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 opacity-0 md:group-hover:opacity-100 transition-opacity active:scale-95"
                              >
                                <Reply className="w-4 h-4" />
                              </button>
                            </div>
                           <span className="text-[9px] text-slate-400 mt-1 font-medium">{getRelativeTime(msg.timestamp)}</span>
                        </motion.div>
                     )
                  })}
                  {chatMessages.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                        <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-sm font-medium">কোনো মেসেজ নেই। নতুন চ্যাট শুরু করুন!</p>
                     </div>
                  )}
               </div>
            </motion.div>
         )}

         {activeTab === "admin" && (
            <motion.div 
               key="admin"
               initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
               className="max-w-4xl mx-auto"
            >
               {!isAdmin ? (
                  <div className="bg-white rounded-[24px] p-8 border border-slate-200 shadow-sm text-center">
                     <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-8 h-8" />
                     </div>
                     <h2 className="text-2xl font-bold text-slate-900 mb-6">অ্যাডমিন লগইন</h2>
                     <div className="space-y-4 mb-6">
                        <input 
                           type="email" 
                           placeholder="অ্যাডমিন ইমেইল"
                           value={adminEmail}
                           onChange={(e) => setAdminEmail(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-center font-bold text-slate-800"
                        />
                        <input 
                           type="password" 
                           placeholder="অ্যাডমিন পিন"
                           value={adminPin}
                           onChange={(e) => setAdminPin(e.target.value)}
                           className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all text-center font-bold tracking-widest text-slate-800"
                        />
                     </div>
                     <form onSubmit={handleAdminLogin}>
                        <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm active:scale-95">
                           লগইন করুন
                        </button>
                     </form>
                  </div>
               ) : (
                  <div>
                     {/* Admin Sub-Navigation Grid */}
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        {[
                           { id: "overview", label: "ড্যাশবোর্ড", icon: LayoutGrid, color: "bg-indigo-50 text-indigo-600" },
                           { id: "posts", label: "সব পোস্ট", icon: FileText, color: "bg-blue-50 text-blue-600" },
                           { id: "active", label: "সক্রিয় লিস্ট", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
                           { id: "offline", label: "অফলাইন লিস্ট", icon: AlertTriangle, color: "bg-amber-50 text-amber-600" },
                           { id: "recovery", label: "রিকভারি", icon: Smartphone, color: "bg-purple-50 text-purple-600" },
                           { id: "reports", label: "রিপোর্ট", icon: ShieldCheck, color: "bg-rose-50 text-rose-600" },
                           { id: "archive", label: "মাস্টার ডাটা", icon: Database, color: "bg-slate-50 text-slate-600" },
                           { id: "settings", label: "সেটিংস", icon: Settings, color: "bg-orange-50 text-orange-600" },
                        ].map((tab) => (
                           <button
                              key={tab.id}
                              onClick={() => setAdminSubTab(tab.id as any)}
                              className={`flex flex-col items-center justify-center p-4 rounded-[28px] border transition-all active:scale-95 ${adminSubTab === tab.id ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}
                           >
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-2 ${tab.color} transition-transform ${adminSubTab === tab.id ? 'scale-110' : ''}`}>
                                 <tab.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                              </div>
                              <span className={`text-[10px] sm:text-xs font-bold tracking-tight ${adminSubTab === tab.id ? 'text-indigo-600' : 'text-slate-600'}`}>{tab.label}</span>
                           </button>
                        ))}
                     </div>

                     <div className="min-h-[400px]">
                        <AnimatePresence mode="wait">
                           {adminSubTab === "overview" && (
                              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-indigo-600 p-6 rounded-[24px] text-white shadow-lg shadow-indigo-200">
                                       <p className="text-xs opacity-80 mb-1 font-bold">মোট ডোনার</p>
                                       <h4 className="text-4xl font-black tracking-tighter">{donors.length}</h4>
                                    </div>
                                    <div className="bg-emerald-600 p-6 rounded-[24px] text-white shadow-lg shadow-emerald-200">
                                       <p className="text-xs opacity-80 mb-1 font-bold">সক্রিয় ডোনার</p>
                                       <h4 className="text-4xl font-black tracking-tighter">{donors.filter(d => d.canDonate === "হ্যাঁ").length}</h4>
                                    </div>
                                    <div className="bg-amber-500 p-6 rounded-[24px] text-white shadow-lg shadow-amber-100">
                                       <p className="text-xs opacity-80 mb-1 font-bold">অফলাইন ডোনার</p>
                                       <h4 className="text-4xl font-black tracking-tighter">{donors.filter(d => d.canDonate === "না").length}</h4>
                                    </div>
                                    <div className="bg-rose-600 p-6 rounded-[24px] text-white shadow-lg shadow-rose-200">
                                       <p className="text-xs opacity-80 mb-1 font-bold">রিপোর্ট সংখ্যা</p>
                                       <h4 className="text-4xl font-black tracking-tighter">{reports.length}</h4>
                                    </div>
                                 </div>
                                 
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                       <Activity className="w-5 h-5 text-indigo-500" /> রিসেন্ট অ্যাক্টিভিটি
                                    </h4>
                                    <div className="space-y-3">
                                       <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                          <span className="text-sm text-slate-600">পেন্ডিং রিকভারি</span>
                                          <span className="font-bold text-indigo-600">{recoveryRequests.filter(r => r.status === "pending").length}</span>
                                       </div>
                                       <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                          <span className="text-sm text-slate-600">মোট পোস্ট</span>
                                          <span className="font-bold text-slate-800">{posts.length}</span>
                                       </div>
                                    </div>
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "posts" && (
                              <motion.div key="posts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} >
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">পাবলিক পোস্ট ম্যানেজমেন্ট ({posts.length})</h3>
                                    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                       {posts.map(post => (
                                          <div key={post.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100">
                                             <img src={post.authorImg || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorPhone}`} className="w-10 h-10 rounded-full shrink-0 object-cover border border-slate-200" />
                                             <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                   <p className="font-bold text-[13px] text-slate-800 truncate">{post.authorName}</p>
                                                   <span className="text-[9px] text-slate-400 font-medium">{getRelativeTime(post.timestamp)}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{post.text}</p>
                                             </div>
                                             <button 
                                               onClick={() => handleDeletePost(post.key)} 
                                               className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors group"
                                               title="পোস্ট মুছে ফেলুন"
                                             >
                                                <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                             </button>
                                          </div>
                                       ))}
                                       {posts.length === 0 && (
                                          <div className="text-center py-8">
                                             <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                             <p className="text-sm text-slate-400">কোনো পোস্ট এখনও করা হয়নি</p>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "active" && (
                              <motion.div key="active" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} >
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">সক্রিয় ডোনার লিস্ট ({donors.filter(d => d.canDonate === "হ্যাঁ").length})</h3>
                                    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                       {donors.filter(d => d.canDonate === "হ্যাঁ").map(d => (
                                          <div key={d.key} className="flex justify-between items-center p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                                             <div className="text-left">
                                                <p className="font-bold text-slate-800 text-sm">{d.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{d.phone} • {d.blood}</p>
                                             </div>
                                             <button onClick={() => handleDeleteUserGlobal(d.key)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                             </button>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "offline" && (
                              <motion.div key="offline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} >
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">অফলাইন ডোনার লিস্ট ({donors.filter(d => d.canDonate === "না").length})</h3>
                                    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                       {donors.filter(d => d.canDonate === "না").map(d => (
                                          <div key={d.key} className="flex justify-between items-center p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                                             <div className="text-left">
                                                <p className="font-bold text-slate-800 text-sm">{d.name}</p>
                                                <p className="text-xs text-slate-500 font-medium">{d.phone} • {d.blood}</p>
                                             </div>
                                             <button onClick={() => handleDeleteUserGlobal(d.key)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                             </button>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "recovery" && (
                              <motion.div key="recovery" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="font-sans">
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
                                       <Smartphone className="w-5 h-5 text-indigo-600" /> রিকভারি অনুরোধ ({recoveryRequests.filter(r => r.status === "pending").length})
                                    </h3>
                                    {recoveryRequests.filter(r => r.status === "pending").length === 0 ? (
                                       <div className="text-center py-6 text-slate-400 text-sm">কোনো পেন্ডিং অনুরোধ নেই</div>
                                    ) : (
                                       <div className="space-y-3">
                                          {recoveryRequests.filter(r => r.status === "pending").map(req => (
                                             <div key={req.phone} className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                                                <div className="text-left">
                                                   <p className="font-black text-indigo-900 text-lg">{req.phone}</p>
                                                   <p className="text-[10px] text-indigo-400 font-bold uppercase">{getRelativeTime(req.timestamp)}</p>
                                                </div>
                                                <button 
                                                   onClick={() => handleApproveRecovery(req.phone)}
                                                   className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
                                                >
                                                   <CheckCircle2 className="w-4 h-4" /> অনুমোদন
                                                </button>
                                             </div>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "reports" && (
                              <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">অ্যাকাউন্ট রিপোর্টস ({reports.length})</h3>
                                    {reports.length === 0 ? (
                                       <div className="text-center py-8 text-slate-400">কোনো রিপোর্ট নেই</div>
                                    ) : (
                                       <div className="space-y-4">
                                          {reports.map(report => {
                                             const reportedUser = donors.find(d => d.key === report.reportedKey);
                                             if (!reportedUser) return null;
                                             return (
                                                <div key={report.key} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                                   <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                                                      <div>
                                                         <p className="text-xs text-amber-600 font-bold mb-1">কারণ: {report.reason}</p>
                                                         <div className="flex items-center gap-2 mb-2">
                                                            <span className="font-bold text-slate-800">{reportedUser.name}</span>
                                                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-md font-bold">{reportedUser.blood}</span>
                                                            {reportedUser.banned && <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded-md font-bold">BANNED</span>}
                                                         </div>
                                                         <p className="text-slate-500 text-sm">ফোন: {reportedUser.phone}</p>
                                                      </div>
                                                      <div className="flex flex-wrap gap-2">
                                                         {!reportedUser.banned ? (
                                                            <button onClick={() => handleBanUser(reportedUser.key, true)} className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg">ব্যান</button>
                                                         ) : (
                                                            <button onClick={() => handleBanUser(reportedUser.key, false)} className="bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg">আনব্যান</button>
                                                         )}
                                                         <button onClick={() => handleDeleteUserGlobal(reportedUser.key)} className="bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg">ডিলিট</button>
                                                         <button onClick={() => handleDeleteReport(report.key)} className="bg-slate-400 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg">ডিসমিস</button>
                                                      </div>
                                                   </div>
                                                </div>
                                             );
                                          })}
                                       </div>
                                    )}
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "archive" && (
                              <motion.div key="archive" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
                                       <Database className="w-5 h-5 text-emerald-600" /> মাস্টার ডাটা (সব: {archivedDonors.length})
                                    </h3>
                                    <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                                       {archivedDonors.map(d => {
                                          const isActive = donors.some(active => active.phone === d.phone);
                                          return (
                                             <div key={d.key} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                                <div className="text-left min-w-0">
                                                   <p className="font-bold text-slate-800 text-sm truncate">{d.name}</p>
                                                   <p className="text-xs text-slate-500">{d.phone}</p>
                                                </div>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                   {isActive ? 'Active' : 'Deleted'}
                                                </span>
                                             </div>
                                          );
                                       })}
                                    </div>
                                 </div>
                              </motion.div>
                           )}

                           {adminSubTab === "settings" && (
                              <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">অ্যাকাউন্ট ও সিকিউরিটি</h3>
                                    <div className="space-y-4">
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div>
                                             <label className="text-xs font-bold text-slate-500 mb-1 block">অ্যাডমিন ইমেইল</label>
                                             <input 
                                                type="email" 
                                                value={appSettings.adminEmail}
                                                onChange={e => setAppSettings({...appSettings, adminEmail: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                             />
                                          </div>
                                          <div>
                                             <label className="text-xs font-bold text-slate-500 mb-1 block">অ্যাডমিন পিন</label>
                                             <input 
                                                type="text" 
                                                value={appSettings.adminPin}
                                                onChange={e => setAppSettings({...appSettings, adminPin: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono"
                                             />
                                          </div>
                                       </div>
                                       <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl">
                                          <div>
                                             <h4 className="font-bold text-red-800 text-sm">গ্লোবাল এডিট সিস্টেম</h4>
                                             <p className="text-[10px] text-red-600 mt-1">সব ইউজারদের তথ্য এডিট করার অনুমতি (অ্যাডমিন কন্ট্রোল)</p>
                                          </div>
                                          <button 
                                             onClick={() => setAppSettings({...appSettings, allowGlobalEdit: !appSettings.allowGlobalEdit})}
                                             className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${appSettings.allowGlobalEdit ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}
                                          >
                                             {appSettings.allowGlobalEdit ? "অন আছে" : "অফ আছে"}
                                          </button>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">সাপোর্ট ও ডোনেশন সেটআপ</h3>
                                    <div className="space-y-4">
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <div>
                                             <label className="text-xs font-bold text-slate-500 mb-1 block">বিকাশ নম্বর</label>
                                             <input 
                                                type="text" 
                                                value={appSettings.bikashNumber}
                                                onChange={e => setAppSettings({...appSettings, bikashNumber: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500/20 outline-none"
                                             />
                                          </div>
                                          <div>
                                             <label className="text-xs font-bold text-slate-500 mb-1 block">নগদ নম্বর</label>
                                             <input 
                                                type="text" 
                                                value={appSettings.nagadNumber}
                                                onChange={e => setAppSettings({...appSettings, nagadNumber: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                                             />
                                          </div>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">গ্লোবাল সেটিংস</h3>
                                    <div className="space-y-4">
                                       <div>
                                          <div className="flex items-center justify-between mb-2">
                                             <label className="text-sm font-bold text-slate-700 block">গ্লোবাল নোটিশ (ব্যানার)</label>
                                             <button 
                                                onClick={() => setAppSettings({...appSettings, showBanner: !appSettings.showBanner})}
                                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${appSettings.showBanner ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}
                                             >
                                                {appSettings.showBanner ? "চালু" : "বন্ধ"}
                                             </button>
                                          </div>
                                          <textarea 
                                             value={appSettings.bannerText}
                                             onChange={e => setAppSettings({...appSettings, bannerText: e.target.value})}
                                             placeholder="সবার জন্য কোনো নোটিশ টাইপ করুন..."
                                             className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[80px]"
                                          />
                                       </div>
                                       <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                          <div>
                                             <h4 className="font-bold text-slate-800 text-sm">পাবলিক গ্রুপ চ্যাট</h4>
                                             <p className="text-[10px] text-slate-500 mt-1">সবাই একসাথে কথা বলার অপশন</p>
                                          </div>
                                          <button 
                                             onClick={() => setAppSettings({...appSettings, chatEnabled: !appSettings.chatEnabled})}
                                             className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${appSettings.chatEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                                          >
                                             {appSettings.chatEnabled ? "চালু" : "বন্ধ"}
                                          </button>
                                       </div>
                                       <button onClick={handleSaveSettings} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                          সেটিংস সেভ করুন
                                       </button>
                                    </div>
                                 </div>

                                 <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm">
                                    <h3 className="font-bold text-slate-800 mb-4 text-lg">নোটিশ বোর্ড ম্যানেজমেন্ট</h3>
                                    <div className="space-y-4">
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                          <input type="text" placeholder="নোটিশ টাইটেল" value={newNotice.title} onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none" />
                                          <input type="text" placeholder="নোটিশ বর্ণনা" value={newNotice.text} onChange={(e) => setNewNotice({ ...newNotice, text: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none" />
                                       </div>
                                       <button onClick={handleSendNotice} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">নোটিশ পাঠান</button>
                                       <div className="pt-4 border-t border-slate-100 space-y-2">
                                          {notices.map(n => (
                                             <div key={n.key} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                                <span className="text-sm font-bold text-slate-700 truncate mr-2">{n.title}</span>
                                                <button onClick={() => handleDeleteNotice(n.key)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  </div>
               )}
            </motion.div>
         )}

         </AnimatePresence>
      </main>

      {/* --- Mobile Bottom Nav --- */}
      <footer className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 pb-safe pt-2 px-6 flex justify-around shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-40 pb-4">
         <button onClick={() => setActiveTab("feed")} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'feed' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-bold">হোম</span>
         </button>
         <button onClick={() => setActiveTab("community")} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'community' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-bold">পোস্ট</span>
         </button>
         {appSettings.chatEnabled && (
            <button 
              onClick={() => {
                setActiveTab("chat");
                setLastSeenMsgCount(chatMessages.length);
              }} 
              className={`flex flex-col items-center gap-1.5 p-2 transition-colors relative ${activeTab === 'chat' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
               <MessageCircle className="w-6 h-6" />
               {chatMessages.length > lastSeenMsgCount && activeTab !== "chat" && (
                 <span className="absolute top-1 right-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm ring-1 ring-red-100">
                   {chatMessages.length - lastSeenMsgCount > 99 ? '99+' : chatMessages.length - lastSeenMsgCount}
                 </span>
               )}
               <span className="text-[10px] font-bold">চ্যাট</span>
            </button>
         )}
         <button onClick={() => setIsSupportModalOpen(true)} className="flex flex-col items-center gap-1.5 p-2 transition-colors text-slate-400 hover:text-rose-600">
            <HeartHandshake className="w-6 h-6" />
            <span className="text-[10px] font-bold">সাপোর্ট</span>
         </button>
         <button onClick={() => setActiveTab("profile")} className={`flex flex-col items-center gap-1.5 p-2 transition-colors ${activeTab === 'profile' ? 'text-red-600' : 'text-slate-400 hover:text-slate-600'}`}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-bold">প্রোফাইল</span>
         </button>
      </footer>

      {/* --- PWA / Install Modal --- */}
      <AnimatePresence>
         {isSupportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pb-10 md:pb-0">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSupportModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-[360px] rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-100 text-center">
                  <button onClick={() => setIsSupportModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                     <X className="w-5 h-5" />
                  </button>
                  <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <HeartHandshake className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">আমাদের সাপোর্ট করুন</h3>
                  <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
                     রক্তদান অ্যাপটি সম্পূর্ণ ফ্রি এবং জনস্বার্থে তৈরি। সার্ভার খরচ ও ডেভেলপমেন্ট চালিয়ে নিতে আপনার সামান্য অনুদান বা বিজ্ঞাপন প্রকাশ বড় ভূমিকা রাখবে। হালাল উপার্জন নিশ্চিত করতে আমরা যেকোনো অনৈতিক মাধ্যম এড়িয়ে চলি।
                  </p>
                  
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4 text-left">
                     <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-rose-500" /> ডোনেট করুন (বিকাশ/নগদ)</h4>
                     <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg font-mono text-sm text-slate-800 shadow-sm">
                           <div className="flex items-center gap-2">
                             <span className="w-2 h-2 bg-pink-500 rounded-full" />
                             <span>{appSettings.bikashNumber}</span>
                           </div>
                           <button onClick={() => { navigator.clipboard.writeText(appSettings.bikashNumber); showNotice('বিকাশ নম্বর কপি হয়েছে!', 'success'); }} className="text-pink-600 text-[10px] font-bold uppercase hover:bg-pink-50 px-2 py-1 rounded transition-colors">Copy</button>
                        </div>
                        <div className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg font-mono text-sm text-slate-800 shadow-sm">
                           <div className="flex items-center gap-2">
                             <span className="w-2 h-2 bg-orange-500 rounded-full" />
                             <span>{appSettings.nagadNumber}</span>
                           </div>
                           <button onClick={() => { navigator.clipboard.writeText(appSettings.nagadNumber); showNotice('নগদ নম্বর কপি হয়েছে!', 'success'); }} className="text-orange-600 text-[10px] font-bold uppercase hover:bg-orange-50 px-2 py-1 rounded transition-colors">Copy</button>
                        </div>
                     </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left">
                     <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><BadgeDollarSign className="w-4 h-4 text-emerald-500" /> বিজ্ঞাপন দিন (Ad Placement)</h4>
                     <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">আপনি চাইলে আমাদের ফিডের উপরে আপনার হালাল ব্যবসা প্রতিষ্ঠান বা ফেসবুক পেজের বিজ্ঞাপন দিতে পারেন। এতে অ্যাপের খরচ উঠবে এবং আপনার ব্যবসাও পরিচিতি পাবে।</p>
                     <a href="mailto:admin@bloodweb.com" className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-xs hover:bg-slate-800 shadow-sm">
                        যোগাযোগ করুন
                     </a>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {isNoticeModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 pb-10 md:pb-0">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNoticeModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-[380px] rounded-[32px] overflow-hidden shadow-2xl border border-slate-100">
                  <div className="bg-gradient-to-r from-red-600 to-rose-700 p-6 text-white flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <BellRing className="w-6 h-6" />
                        <h3 className="text-xl font-bold">নোটিশ বোর্ড</h3>
                     </div>
                     <button onClick={() => setIsNoticeModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3 bg-slate-50">
                     {notices.map(notice => (
                        <div key={notice.key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-12 h-12 bg-red-50 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                           <h4 className="font-black text-slate-800 mb-1 text-[15px]">{notice.title}</h4>
                           <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{notice.text}</p>
                           <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{getRelativeTime(notice.timestamp)}</span>
                              <Droplet className="w-3 h-3 text-red-500 fill-current opacity-30" />
                           </div>
                        </div>
                     ))}
                     {notices.length === 0 && (
                        <div className="text-center py-10">
                           <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                           <p className="text-sm text-slate-400 font-bold">আপাতত কোনো নোটিশ নেই</p>
                        </div>
                     )}
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 text-center">
                     <p className="text-[10px] text-slate-400 font-bold">Blood Donor Online Official Notice</p>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {isPwaModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pb-10 md:pb-0">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPwaModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-[340px] rounded-[32px] p-8 shadow-2xl border border-slate-100 text-center">
                  <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5">
                     <Smartphone className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">App ইনস্টল করুন</h3>
                  <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                     সেরা অভিজ্ঞতার জন্য আমাদের অ্যাপটি আপনার ফোনে ইনস্টল করে রাখুন। অফলাইনেও ডোনার খুঁজতে পারবেন!
                  </p>
                  
                  <button onClick={handleInstallClick} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all mb-3 flex items-center justify-center gap-2">
                     <Download className="w-5 h-5" /> এখন ইনস্টল করুন
                  </button>
                  <a href="https://www.mediafire.com/file/n89knndg1p9zxbb/_Blood_Donor_Online_19784143.apk/file" target="_blank" rel="noreferrer" className="w-full bg-white border-2 border-red-100 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2 mb-4">
                     <Upload className="w-4 h-4 rotate-180" /> Android APK ফাইল
                  </a>

                  <button onClick={() => setIsPwaModalOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider">
                     পরে করবো
                  </button>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {dollarCardPost && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDollarCardPost(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                 className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
               >
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-center text-white relative">
                     <button onClick={() => setDollarCardPost(null)} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                     <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-inner">
                        <BadgeDollarSign className="w-10 h-10" />
                     </div>
                     <h2 className="text-2xl font-black tracking-tight mb-1">ডোনার কার্ড</h2>
                     <p className="text-emerald-50/80 text-sm font-medium">রক্তদান সেবার বিশেষ সম্মাননা</p>
                  </div>
                  <div className="p-6">
                     <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner text-left">
                        <img src={dollarCardPost.authorImg || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dollarCardPost.authorPhone}`} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" />
                        <div className="overflow-hidden">
                           <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{dollarCardPost.authorName}</h3>
                           <p className="text-sm text-slate-400 font-medium">{dollarCardPost.authorPhone}</p>
                        </div>
                     </div>
                     <div className="space-y-4 mb-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-left">
                           <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-2">পোস্টের তথ্য</p>
                           <div className="text-sm text-slate-700 leading-relaxed overflow-hidden">
                              {dollarCardPost.text.length > 120 && !expandedPosts[dollarCardPost.key + '_card'] ? (
                                 <>
                                    {dollarCardPost.text.substring(0, 120)}...
                                    <button 
                                       onClick={() => setExpandedPosts(prev => ({...prev, [dollarCardPost.key + '_card']: true}))}
                                       className="text-emerald-600 font-bold ml-1 hover:underline"
                                    >
                                       more..
                                    </button>
                                 </>
                              ) : (
                                 <>
                                    {dollarCardPost.text}
                                    {dollarCardPost.text.length > 120 && (
                                       <button 
                                          onClick={() => setExpandedPosts(prev => ({...prev, [dollarCardPost.key + '_card']: false}))}
                                          className="text-emerald-600 font-bold ml-1 hover:underline"
                                       >
                                          less
                                       </button>
                                    )}
                                 </>
                              )}
                           </div>
                        </div>
                     </div>
                     <button 
                       onClick={() => setDollarCardPost(null)}
                       className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                     >
                        বন্ধ করুন
                     </button>
                  </div>
                  <div className="bg-slate-50 py-3 text-center border-t border-slate-100">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter italic">Blood Donor Online Official Verify</p>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* --- Long Press Chat Menu --- */}
      <AnimatePresence>
         {longPressMsg && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLongPressMsg(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
               <motion.div 
                 initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                 className="relative bg-white w-full max-w-sm rounded-t-[32px] overflow-hidden shadow-2xl p-6"
               >
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                  <h3 className="text-center font-bold text-slate-800 mb-6 font-sans">মেসেজ অপশন</h3>
                  <div className="space-y-3">
                     <button 
                       onClick={() => {
                          navigator.clipboard.writeText(longPressMsg.text || "");
                          showNotice("মেসেজ কপি হয়েছে", "success");
                          setLongPressMsg(null);
                       }}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-bold"
                     >
                        <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center">
                           <Copy className="w-5 h-5" />
                        </div>
                        মেসেজ কপি করুন
                     </button>
                     <button 
                       onClick={() => {
                         setReplyingTo(longPressMsg);
                         setLongPressMsg(null);
                       }}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 font-bold"
                     >
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                           <Reply className="w-5 h-5" />
                        </div>
                        রিপ্লাই দিন
                     </button>
                     {(isAdmin || longPressMsg.senderKey === (myKey || (guestName ? ("guest-" + guestName.trim().replace(/\s+/g, '-').toLowerCase()) : null))) && (
                       <button 
                         onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              message: "এই মেসেজটি চিরতরে ডিলিট করতে চান?",
                              onConfirm: async () => {
                                 await remove(ref(database, `chat/${longPressMsg.key}`));
                                 setLongPressMsg(null);
                                 setConfirmDialog(null);
                                 showNotice("মেসেজ ডিলিট হয়েছে", "success");
                              }
                            });
                         }}
                         className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-50 hover:bg-red-100 transition-colors text-red-600 font-bold"
                       >
                          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                             <Trash2 className="w-5 h-5" />
                          </div>
                          মেসেজ মুছুন (Delete)
                       </button>
                     )}
                     <button 
                        onClick={() => setLongPressMsg(null)}
                        className="w-full py-4 text-slate-400 font-bold text-sm"
                     >
                        বন্ধ করুন
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* --- Donor Card Modal (Beautifully Animated) --- */}
      <AnimatePresence>
         {activeDonorModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                 onClick={() => setActiveDonorModal(null)} 
                 className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
               />
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 40 }} 
                 animate={{ opacity: 1, scale: 1, y: 0 }} 
                 exit={{ opacity: 0, scale: 0.9, y: 40 }} 
                 className="relative bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl font-sans"
               >
                  {/* Top Banner/Header */}
                  <div className="bg-gradient-to-br from-red-600 to-rose-700 p-8 text-center text-white relative">
                     <button onClick={() => setActiveDonorModal(null)} className="absolute top-6 right-6 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                     </button>
                     <div className="relative inline-block mb-4">
                        <img 
                          src={activeDonorModal.profileImg || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeDonorModal.phone}`} 
                          className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl" 
                        />
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white text-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-red-50">
                           <Star className="w-4 h-4 fill-current" />
                        </div>
                     </div>
                     <h2 className="text-2xl font-black mb-1">{activeDonorModal.name}</h2>
                     <div className="flex items-center justify-center gap-1.5 text-red-50/80 text-xs font-bold uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" />
                        {activeDonorModal.loc}
                     </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 pt-8 -mt-6 bg-white rounded-t-[40px] relative">
                     <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-red-50/50 p-4 rounded-3xl border border-red-100 flex flex-col items-center justify-center">
                           <span className="text-3xl font-black text-red-600 leading-none">{activeDonorModal.blood}</span>
                           <span className="text-[10px] font-bold text-red-500/60 uppercase mt-1">রক্তের গ্রুপ</span>
                        </div>
                        <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center">
                           <span className="text-xs font-black text-emerald-600 leading-none">Pos</span>
                           <span className="text-[10px] font-bold text-emerald-600/60 uppercase mt-1">রক্ত দানে প্রস্তুত</span>
                        </div>
                     </div>

                     <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between px-2">
                           <span className="text-slate-400 text-sm font-bold">ওজন</span>
                           <span className="text-slate-800 font-black">{activeDonorModal.weight || "৫০+"} কেজি</span>
                        </div>
                        <div className="flex items-center justify-between px-2">
                           <span className="text-slate-400 text-sm font-bold">মোট দান</span>
                           <span className="text-slate-800 font-black">{activeDonorModal.times || "০"} বার</span>
                        </div>
                        <div className="flex items-center justify-between px-2">
                           <span className="text-slate-400 text-sm font-bold">শেষ দান</span>
                           <span className="text-slate-800 font-black">{activeDonorModal.last || "কখনো না"}</span>
                        </div>
                     </div>

                     <div className="flex items-center justify-center gap-6 mb-8 py-4 bg-slate-50 rounded-3xl border border-slate-100">
                        <div className="text-center">
                           <p className="text-lg font-black text-slate-800 leading-none">{activeDonorModal.rating || 95}% আস্থা</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">ভেরিফাইড</p>
                        </div>
                        <div className="w-px h-8 bg-slate-200" />
                        <div className="text-center">
                           <p className="text-lg font-black text-slate-800 leading-none">{activeDonorModal.followers || 1} ফলোয়ার</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">কমিউনিটি</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => incrementFollowers(activeDonorModal.key)}
                          className="bg-white border-2 border-slate-200 text-slate-700 font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95"
                        >
                           ফলো করুন
                        </button>
                        <a 
                          href={`tel:${activeDonorModal.phone}`}
                          className="bg-red-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95"
                        >
                           <Phone className="w-5 h-5 fill-current" /> কল করুন
                        </a>
                     </div>
                  </div>

                  <div className="bg-slate-50 py-3 text-center border-t border-slate-100 uppercase tracking-tighter italic">
                     <p className="text-[9px] text-slate-400 font-black">Official Donor Identify Card • Blood Donor Online</p>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {isGuestNameModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-sm p-8 shadow-2xl border border-slate-200"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 rotate-3">
                <UserCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">আপনার নাম দিন</h3>
              <p className="text-slate-500 text-center text-sm mb-6">চ্যাট করতে আপনার একটি নাম প্রয়োজন যাতে অন্যরা আপনাকে চিনতে পারে।</p>
              
              <form onSubmit={handleSaveGuestName}>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="আপনার নাম লিখুন..." 
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-center font-bold text-slate-800 mb-4"
                />
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsGuestNameModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                  >
                    বন্ধ করুন
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    শুরু করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportModal?.isOpen && (
            <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 pb-10 md:pb-0">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReportModal(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
               <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-[340px] rounded-[32px] p-6 shadow-2xl border border-slate-100 text-center">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">রিপোর্ট করুন</h3>
                  <textarea 
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none mb-4 min-h-[80px]" 
                     placeholder="রিপোর্টের কারণ লিখুন..." 
                     value={reportReason} 
                     onChange={e => setReportReason(e.target.value)} 
                  />
                  <div className="flex gap-3">
                     <button onClick={() => setReportModal(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm">
                        বাতিল
                     </button>
                     <button onClick={submitReport} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm flex justify-center items-center gap-2">
                        <User className="w-4 h-4"/> রিপোর্ট জমা দিন
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDialog?.isOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 pb-10 md:pb-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDialog(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-[320px] rounded-[32px] p-6 shadow-2xl border border-slate-100 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">নিশ্চিত করুন</h3>
              <p className="text-sm font-medium text-slate-500 mb-6">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                  না
                </button>
                <button onClick={confirmDialog.onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-sm">
                  হ্যাঁ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Global Toast Notifications --- */}
      <div className="fixed top-20 md:top-6 md:bottom-auto bottom-24 right-0 left-0 md:left-auto md:right-6 z-50 flex flex-col gap-3 px-4 pointer-events-none items-center md:items-end">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8, y: -20 }} layout
              className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-md min-w-[280px] pointer-events-auto
                ${toast.type === 'success' ? 'bg-white border-emerald-500 text-emerald-800' : 
                  toast.type === 'warning' ? 'bg-white border-amber-500 text-amber-800' : 
                  'bg-white border-slate-200 text-slate-800'}`}
            >
              {toast.type === 'success' ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : 
               toast.type === 'warning' ? <Bell className="w-5 h-5 text-amber-500" /> : 
               <Bell className="w-5 h-5 text-blue-500" />}
              <span className="font-bold text-[13px] flex-1">{toast.message}</span>
              <button onClick={() => setToasts(t => t.filter(x => x.id !== toast.id))} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
