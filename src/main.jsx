import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ethers, Contract, JsonRpcProvider, formatEther, isAddress, parseEther } from "ethers";
import {
  Activity,
  ChevronDown,
  Coins,
  Copy,
  ExternalLink,
  FileCheck,
  Globe,
  Home,
  Info,
  LockKeyhole,
  LogOut,
  Map,
  Moon,
  SearchCheck,
  ShieldCheck,
  Sun,
  Wallet,
  Workflow
} from "lucide-react";
import "./style.css";

const OPN_CHAIN_ID_HEX = "0x3d8";
const OPN_TESTNET = {
  chainId: OPN_CHAIN_ID_HEX,
  chainName: "OPN Testnet",
  nativeCurrency: { name: "OPN", symbol: "OPN", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.iopn.tech"],
  blockExplorerUrls: ["https://testnet.iopn.tech"]
};

const DEPLOYED_VESTFLOW_ADDRESS = "0x5E0d0146804E6c34f748CED382C5ee179aFb3A5E";
const VESTFLOW_ADDRESS = import.meta.env.VITE_VESTFLOW_ADDRESS || DEPLOYED_VESTFLOW_ADDRESS;
const DEPLOY_TX = "0x7638dc202f14c797b3441aa50375fab6e07ba5ea2cffb2da08c3e2111c796f59";
const DEPLOYER = "0xd564ab77aDE8D2a4f3199d71f4Aa9F487976d63C";
const EXPLORER_URL = "https://testnet.iopn.tech/address/0x5E0d0146804E6c34f748CED382C5ee179aFb3A5E";
const GITHUB_URL = "https://github.com/ekypanawa/vestflow-protocol";
const DAPP_URL = "https://vestflow-protocol.vercel.app";
const METAMASK_DAPP_URL = "https://metamask.app.link/dapp/vestflow-protocol.vercel.app";
const OPN_BALANCE_LOGO = "/opn-balance-logo.png";
const GAS_BUFFER_OPN = 0.005;
const NOTE_OPTIONS = ["Contributor Reward", "Grant Distribution", "Team Vesting", "Community Campaign", "Ecosystem Reserve"];
const CUSTOM_NOTE_OPTION = "Other / Custom note";
const DURATION_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 }
];

const ABI = [
  "function createVault(address recipient,uint64 cliffSeconds,uint64 durationSeconds,string title) payable returns (uint256)",
  "function claim(uint256 vaultId)",
  "function claimableAmount(uint256 vaultId) view returns (uint256)",
  "function vestedAmount(uint256 vaultId) view returns (uint256)",
  "function nextVaultId() view returns (uint256)",
  "function getCreatedVaults(address creator) view returns (uint256[])",
  "function getRecipientVaults(address recipient) view returns (uint256[])",
  "function vaults(uint256) view returns (address creator,address recipient,uint256 amount,uint256 claimed,uint64 start,uint64 cliff,uint64 duration,bool cancelled,string title)",
  "event VaultCreated(uint256 indexed vaultId,address indexed creator,address indexed recipient,uint256 amount,uint64 start,uint64 cliff,uint64 duration,string title)",
  "event Claimed(uint256 indexed vaultId,address indexed recipient,uint256 amount)"
];

const navItems = [
  { label: "Home", id: "home", Icon: Home },
  { label: "Lock", id: "lock", Icon: LockKeyhole },
  { label: "Track & Claim", id: "track", Icon: SearchCheck },
  { label: "Proof", id: "proof", Icon: ShieldCheck },
  { label: "Guide", id: "guide", Icon: Workflow },
  { label: "Roadmap", id: "roadmap", Icon: Map },
  { label: "About", id: "about", Icon: Info }
];

function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatWalletBalance(value) {
  if (!value) return "--";
  const formatted = Number(value);
  if (!Number.isFinite(formatted)) return "--";
  return formatted.toLocaleString(undefined, {
    maximumFractionDigits: formatted >= 1 ? 4 : 6
  });
}

function normalizeDecimalInput(value) {
  return String(value || "").trim().replace(",", ".");
}

function formatAmountInput(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(6).replace(/\.?0+$/, "");
}

function getFutureDateTimeLocal(days) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getWalletDisplayName(wallet) {
  const name = wallet?.info?.name || wallet?.name || wallet?.providerInfo?.name;
  if (name) return name;

  const provider = wallet?.provider || wallet;
  if (provider?.isOkxWallet || provider?.isOKExWallet) return "OKX Wallet";
  if (provider?.isRabby) return "Rabby Wallet";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isRonin) return "Ronin Wallet";
  if (provider?.isMetaMask) return "MetaMask";

  return "Browser Wallet";
}

function getWalletIcon(wallet) {
  return wallet?.info?.icon || wallet?.icon || wallet?.providerInfo?.icon || "";
}

function normalizeWalletName(value) {
  return String(value || "").trim().toLowerCase();
}

function getWalletProvider(wallet) {
  return wallet?.provider || wallet;
}

function isOkxProvider(provider) {
  return Boolean(provider?.isOkxWallet || provider?.isOKExWallet);
}

function isMetaMaskWallet(wallet) {
  const rdns = normalizeWalletName(wallet?.info?.rdns || wallet?.rdns || wallet?.providerInfo?.rdns);
  const name = normalizeWalletName(getWalletDisplayName(wallet));
  return rdns === "io.metamask" || name.includes("metamask");
}

function findMetaMaskProvider(wallets = []) {
  if (typeof window === "undefined") return null;
  const eip6963Wallet = wallets.find((wallet) => isMetaMaskWallet(wallet) && wallet?.provider?.request);
  if (eip6963Wallet?.provider?.request) return eip6963Wallet.provider;

  const injectedProviders = Array.isArray(window.ethereum?.providers) ? window.ethereum.providers : [];
  const injectedMetaMask = injectedProviders.find((provider) => provider?.isMetaMask && !isOkxProvider(provider));
  if (injectedMetaMask?.request) return injectedMetaMask;

  if (window.ethereum?.isMetaMask && !isOkxProvider(window.ethereum)) return window.ethereum;
  return null;
}

function getWalletDedupeKey(wallet) {
  const rdns = wallet?.info?.rdns || wallet?.rdns || wallet?.providerInfo?.rdns;
  const providedName = wallet?.info?.name || wallet?.name || wallet?.providerInfo?.name;
  const name = normalizeWalletName(providedName || getWalletDisplayName(wallet));
  const icon = getWalletIcon(wallet);
  const key = rdns || name || `${getWalletDisplayName(wallet)}-${icon}`;
  return normalizeWalletName(key);
}

function hasWalletMetadata(wallet) {
  return Boolean(wallet?.info?.rdns || wallet?.info?.name || wallet?.info?.icon || wallet?.providerInfo?.name || wallet?.providerInfo?.icon || wallet?.name || wallet?.icon);
}

function hasRichWalletMetadata(wallet) {
  return Boolean(wallet?.info?.rdns || wallet?.info?.name || wallet?.info?.icon || wallet?.providerInfo?.name || wallet?.providerInfo?.icon || wallet?.icon);
}

function dedupeWallets(wallets) {
  const seen = new Set();
  const uniqueWallets = wallets.filter((wallet) => {
    const provider = getWalletProvider(wallet);
    if (!provider?.request) return false;
    const key = getWalletDedupeKey(wallet);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const richNames = new Set(
    uniqueWallets
      .filter(hasRichWalletMetadata)
      .map((wallet) => normalizeWalletName(getWalletDisplayName(wallet)))
      .filter(Boolean)
  );

  return uniqueWallets.filter((wallet) => {
    const name = normalizeWalletName(getWalletDisplayName(wallet));
    return hasRichWalletMetadata(wallet) || !richNames.has(name);
  });
}

function getFallbackWallets(detectedWallets) {
  const detectedNames = detectedWallets.map((wallet) => normalizeWalletName(getWalletDisplayName(wallet)));
  const fallbacks = [];

  const metaMaskProvider = findMetaMaskProvider(detectedWallets);
  if (!detectedNames.some((name) => name.includes("metamask")) && metaMaskProvider?.request) {
    fallbacks.push({ provider: metaMaskProvider, name: "MetaMask", fallback: true });
  }
  if (!detectedNames.some((name) => name.includes("okx")) && (window.okxwallet?.request || window.ethereum?.request)) {
    fallbacks.push({ provider: window.okxwallet || window.ethereum, name: "OKX Wallet", fallback: true });
  }
  if (!detectedWallets.length && window.ethereum?.request) {
    fallbacks.push({ provider: window.ethereum, name: "Browser Wallet", fallback: true });
  }

  return fallbacks;
}

function prepareWalletList(wallets) {
  const detectedWallets = dedupeWallets(wallets);
  return dedupeWallets([...detectedWallets, ...getFallbackWallets(detectedWallets)]);
}

function getInjectedWallets() {
  if (typeof window === "undefined") return [];
  const injectedProviders = Array.isArray(window.ethereum?.providers)
    ? window.ethereum.providers
    : window.ethereum
      ? [window.ethereum]
      : [];
  const wallets = injectedProviders.map((provider) => ({ provider }));

  if (window.okxwallet) {
    wallets.push({ provider: window.okxwallet, name: "OKX Wallet" });
  }

  return prepareWalletList(wallets);
}

function getDefaultReleaseDate() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("vestflow-theme") || "dark";
}

function getInitialActivity() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem("vestflow-activity") || "[]");
  } catch {
    return [];
  }
}

function isMobileUserAgent() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile|iemobile|opera mini/i.test(navigator.userAgent || "");
}

function getWalletNotFoundMessage() {
  return isMobileUserAgent()
    ? "Open this dApp inside MetaMask or OKX Wallet browser to connect on mobile."
    : "No wallet found. Install MetaMask or OKX Wallet.";
}

function getVaultStatus(vault) {
  return getVaultStatusDetails(vault).label;
}

function getVaultStatusDetails(vault) {
  if (!vault) return { label: "Not loaded", tone: "claimed", helper: "" };
  const amount = BigInt(vault.amountRaw || 0);
  const claimed = BigInt(vault.claimedRaw || 0);
  const vested = BigInt(vault.vestedRaw || 0);
  const claimable = BigInt(vault.claimableRaw || 0);
  const remaining = amount > claimed ? amount - claimed : 0n;
  const closeToRemaining = remaining > 0n && claimable > 0n && (claimable >= remaining || remaining - claimable <= 1n);

  if (amount > 0n && claimed >= amount) {
    return { label: "Claimed", tone: "claimed", helper: "" };
  }
  if (claimable === 0n) {
    return { label: "Vesting in Progress", tone: "vesting", helper: "No OPN is claimable yet." };
  }
  if (!closeToRemaining && claimable < remaining) {
    return { label: "Partially Vested", tone: "partial", helper: "Small amount available" };
  }
  if (claimable > 0n && closeToRemaining) {
    return { label: "Ready to Claim", tone: "ready", helper: "" };
  }
  return { label: "Vesting in Progress", tone: "vesting", helper: "No OPN is claimable yet." };
}

function getVaultUnlockNote(vault) {
  if (!vault) return "";
  const cliff = Number(vault.cliff || 0);
  const duration = Number(vault.duration || 0);

  if (duration > 0 && cliff >= duration) {
    return "Simple timelock unlocks the full amount after the release date.";
  }
  return "Linear vesting unlocks gradually over time. Claimable amount may start small and increase until the release date.";
}

function getVaultLockupLabel(vault) {
  if (!vault) return "";
  const cliff = Number(vault.cliff || 0);
  const duration = Number(vault.duration || 0);
  return duration > 0 && cliff >= duration ? "Simple Timelock" : "Linear Vesting";
}

function getVaultReleaseDate(vault) {
  if (!vault?.start || !vault?.duration) return "";
  const releaseTimestamp = (Number(vault.start) + Number(vault.duration)) * 1000;
  if (!Number.isFinite(releaseTimestamp) || releaseTimestamp <= 0) return "";
  return new Date(releaseTimestamp).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function VaultStatus({ vault }) {
  const status = vault?.cancelled
    ? { label: "Cancelled", tone: "claimed", helper: "" }
    : getVaultStatusDetails(vault);
  const unlockNote = getVaultUnlockNote(vault);

  return (
    <div className="vault-status-row">
      <b>Status:</b>
      <div>
        <span className={`vault-status-badge ${status.tone}`}>{status.label}</span>
        {status.helper ? <span className={`vault-status-helper ${status.tone}`}>{status.helper}</span> : null}
        {unlockNote ? <p className="vault-unlock-note">{unlockNote}</p> : null}
      </div>
    </div>
  );
}

function TrackVaultDetails({ vault, vaultId, onCopyRecipient }) {
  const status = vault?.cancelled
    ? { label: "Cancelled", tone: "claimed", helper: "" }
    : getVaultStatusDetails(vault);
  const unlockNote = getVaultUnlockNote(vault);
  const releaseDate = getVaultReleaseDate(vault);
  const lockupStyle = getVaultLockupLabel(vault);

  return (
    <div className="vault-summary">
      <div className="claim-summary">
        <div className="claim-summary-amount">
          <span>Claimable</span>
          <strong className="claimable-value">{vault.claimable || "0.0"} OPN</strong>
        </div>
        <div className="claim-summary-status">
          <span className={`status-badge ${status.tone}`}>{status.label}</span>
          {status.helper ? <small className={`status-helper ${status.tone}`}>{status.helper}</small> : null}
        </div>
      </div>
      {unlockNote ? <p className="vesting-note">{unlockNote}</p> : null}
      <div className="vault-summary-grid">
        <div><span>Title</span><strong>{vault.title || "Untitled"}</strong></div>
        <div>
          <span>Recipient</span>
          <div className="recipient-summary">
            <code>{shortAddress(vault.recipient)}</code>
            <button type="button" onClick={onCopyRecipient} aria-label="Copy recipient address">
              <Copy aria-hidden="true" size={14} />
            </button>
          </div>
        </div>
        <div><span>Total</span><strong>{vault.amount} OPN</strong></div>
        <div><span>Claimed</span><strong>{vault.claimed} OPN</strong></div>
        <div><span>Vested</span><strong>{vault.vested || "0.0"} OPN</strong></div>
        <div><span>Vault ID</span><strong>{vaultId || "None"}</strong></div>
        {lockupStyle ? <div><span>Lockup Style</span><strong>{lockupStyle}</strong></div> : null}
        {releaseDate ? <div><span>Release Date</span><strong>{releaseDate}</strong></div> : null}
      </div>
    </div>
  );
}

function App() {
  const [account, setAccount] = useState("");
  const [, setStatus] = useState("Ready to build on OPN Testnet.");
  const [theme, setTheme] = useState(getInitialTheme);
  const [activePage, setActivePage] = useState("home");
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [detectedWallets, setDetectedWallets] = useState(getInjectedWallets);
  const [selectedWalletProvider, setSelectedWalletProvider] = useState(null);
  const [selectedWalletName, setSelectedWalletName] = useState("");
  const [walletBalance, setWalletBalance] = useState("");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [activity, setActivity] = useState(getInitialActivity);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [assetTab, setAssetTab] = useState("native");
  const [useCustomRecipient, setUseCustomRecipient] = useState(false);
  const [durationPreset, setDurationPreset] = useState("custom");
  const [noteOption, setNoteOption] = useState("Contributor Reward");
  const [formChangedAfterReceipt, setFormChangedAfterReceipt] = useState(false);
  const [form, setForm] = useState({
    recipient: "",
    amount: "0.01",
    lockupStyle: "linear",
    releaseDate: getDefaultReleaseDate(),
    note: "Contributor Reward"
  });
  const [vaultId, setVaultId] = useState("");
  const [vaultInfo, setVaultInfo] = useState(null);
  const [myVaults, setMyVaults] = useState([]);
  const [isVaultListLoading, setIsVaultListLoading] = useState(false);
  const [vaultLoadError, setVaultLoadError] = useState("");
  const [showVaultLoadSlowHint, setShowVaultLoadSlowHint] = useState(false);
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [nextVaultId, setNextVaultId] = useState("...");
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [proofReceipt, setProofReceipt] = useState(null);
  const walletMenuRef = useRef(null);
  const releaseDateInputRef = useRef(null);

  const contractReady = useMemo(() => Boolean(VESTFLOW_ADDRESS), []);
  const contractStatus = account ? "Connected" : "Not Connected";
  const isMobileBrowser = useMemo(() => isMobileUserAgent(), []);
  const displayedWalletBalance = isBalanceLoading ? "..." : formatWalletBalance(walletBalance);
  const recipientAddress = useCustomRecipient ? form.recipient.trim() : account;
  const amountValue = normalizeDecimalInput(form.amount);
  const parsedAmountValue = Number(amountValue);
  const parsedWalletBalance = Number(walletBalance);
  const hasKnownWalletBalance = Boolean(walletBalance) && Number.isFinite(parsedWalletBalance);
  const amountSliderValue = hasKnownWalletBalance && parsedWalletBalance > 0 && Number.isFinite(parsedAmountValue)
    ? Math.min(100, Math.max(0, Math.round((parsedAmountValue / parsedWalletBalance) * 100)))
    : 0;
  const lockupLabel = form.lockupStyle === "timelock" ? "Simple Timelock" : "Linear Vesting";
  const lockupBehavior = form.lockupStyle === "timelock"
    ? "Unlocks full amount after release date."
    : "Unlocks gradually over time.";
  const showLockPreview = !proofReceipt || formChangedAfterReceipt;
  const previewNote = form.note.trim() || "VestFlow Lock";
  const hasAvailableWalletProvider = useMemo(
    () => Boolean(selectedWalletProvider?.request || window.ethereum?.request || detectedWallets.some((wallet) => getWalletProvider(wallet)?.request)),
    [detectedWallets, selectedWalletProvider]
  );

  const refreshWalletBalance = useCallback(async (targetAccount = account, providerOverride = null) => {
    if (!targetAccount) {
      setWalletBalance("");
      setIsBalanceLoading(false);
      return;
    }

    const injectedProvider = providerOverride || selectedWalletProvider || window.ethereum;
    if (!injectedProvider?.request) {
      setWalletBalance("");
      setIsBalanceLoading(false);
      return;
    }

    try {
      setIsBalanceLoading(true);
      const provider = new ethers.BrowserProvider(injectedProvider);
      const balanceWei = await provider.getBalance(targetAccount);
      setWalletBalance(formatEther(balanceWei));
    } catch {
      setWalletBalance("");
    } finally {
      setIsBalanceLoading(false);
    }
  }, [account, selectedWalletProvider]);

  function updateLockForm(updates) {
    setForm((currentForm) => ({
      ...currentForm,
      ...updates
    }));
    setFormChangedAfterReceipt(true);
  }

  function handleNoteOptionChange(value) {
    setNoteOption(value);
    updateLockForm({ note: value === CUSTOM_NOTE_OPTION ? "" : value });
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("vestflow-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("vestflow-activity", JSON.stringify(activity.slice(0, 8)));
  }, [activity]);

  useEffect(() => {
    if (!toasts.length) return;
    const timeout = window.setTimeout(() => {
      setToasts((currentToasts) => currentToasts.slice(1));
    }, 4200);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  useEffect(() => {
    if (!walletDropdownOpen) return;

    const handleClickOutside = (event) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target)) {
        setWalletDropdownOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setWalletDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [walletDropdownOpen]);

  useEffect(() => {
    const selectedVaultId = vaultId.trim();
    if (!selectedVaultId) {
      setVaultInfo(null);
      setIsVaultLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadSelectedVaultData(selectedVaultId);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [vaultId]);

  useEffect(() => {
    if (account) {
      loadMyVaults(false);
    } else {
      setMyVaults([]);
    }
  }, [account]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const revealTargets = Array.from(
      document.querySelectorAll("[data-reveal], .reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-scale")
    );
    if (!revealTargets.length) return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) {
      revealTargets.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -80px 0px"
      }
    );

    revealTargets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [activePage, activityExpanded, proofReceipt, vaultInfo, myVaults.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const addWallets = (wallets) => {
      setDetectedWallets((currentWallets) => prepareWalletList([...currentWallets, ...wallets]));
    };

    const handleProviderAnnouncement = (event) => {
      if (event?.detail) addWallets([event.detail]);
    };

    addWallets(getInjectedWallets());
    window.addEventListener("eip6963:announceProvider", handleProviderAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () => {
      window.removeEventListener("eip6963:announceProvider", handleProviderAnnouncement);
    };
  }, []);

  useEffect(() => {
    const walletProvider = selectedWalletProvider || window.ethereum;
    if (!walletProvider?.on) return;

    const handleAccountsChanged = (accounts) => {
      const nextAccount = accounts?.[0] || "";
      setAccount(nextAccount);
      if (nextAccount) {
        notify("Wallet connected", "Wallet account changed.");
        addActivity("Wallet Connected", `Connected ${shortAddress(nextAccount)}.`);
        refreshWalletBalance(nextAccount, walletProvider);
      } else {
        setWalletBalance("");
        setIsBalanceLoading(false);
        notify("Wallet disconnected", "Wallet disconnected.");
        addActivity("Wallet Disconnected", "Local wallet session cleared.");
      }
    };

    const handleChainChanged = () => {
      if (account) refreshWalletBalance(account, walletProvider);
    };

    walletProvider.on("accountsChanged", handleAccountsChanged);
    walletProvider.on("chainChanged", handleChainChanged);

    return () => {
      walletProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      walletProvider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [account, refreshWalletBalance, selectedWalletProvider]);

  useEffect(() => {
    if (account) {
      refreshWalletBalance(account);
    } else {
      setWalletBalance("");
      setIsBalanceLoading(false);
    }
  }, [account, refreshWalletBalance]);

  function notify(title, description = "", type = "info") {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((currentToasts) => [...currentToasts.slice(-3), { id, title, description, type }]);
    setStatus(description || title);
  }

  function addActivity(title, description, txHash = "") {
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description,
      txHash,
      timestamp: new Date().toISOString()
    };
    setActivity((currentActivity) => [item, ...currentActivity].slice(0, 8));
  }

  function reportError(error) {
    const code = error?.code || error?.info?.error?.code;
    let message = error?.shortMessage || error?.message || "Transaction failed.";
    if (code === -32002) message = "MetaMask request already pending. Open MetaMask and approve or reject it.";
    if (code === 4001 || error?.code === "ACTION_REJECTED") message = "Wallet connection cancelled.";
    const knownErrors = [
      "Connect wallet first.",
      "Wallet not found. Install MetaMask or OKX Wallet.",
      "MetaMask request already pending. Open MetaMask and approve or reject it.",
      "Wallet connection cancelled.",
      "Recipient address is required.",
      "Invalid recipient address.",
      "Amount must be greater than 0.",
      "Amount exceeds wallet balance.",
      "Release date must be in the future.",
      "Enter a Vault ID first.",
      "Vault ID must be a valid number.",
      "Nothing available to claim yet.",
      "Only the recipient wallet can claim this vault.",
      "Claim cancelled.",
      "Check your wallet for a pending request.",
      "Open this dApp inside MetaMask or OKX Wallet browser to connect on mobile.",
      "No wallet found. Install MetaMask or OKX Wallet."
    ];
    notify(knownErrors.includes(message) ? message : "Transaction failed", knownErrors.includes(message) ? "" : message, "error");
  }

  function normalizeWalletError(error, fallback = "Transaction failed") {
    const code = error?.code || error?.info?.error?.code;
    const message = error?.shortMessage || error?.message || fallback;
    const lowerMessage = String(message || fallback).toLowerCase();

    if (code === -32002 || lowerMessage.includes("already pending") || lowerMessage.includes("request of type")) {
      return "MetaMask request already pending. Open MetaMask and approve or reject it.";
    }
    if (code === 4001 || code === "ACTION_REJECTED" || lowerMessage.includes("user rejected") || lowerMessage.includes("user denied")) {
      return "Wallet connection cancelled.";
    }
    if (lowerMessage.includes("recipient") || lowerMessage.includes("not recipient")) {
      return "Only the recipient wallet can claim this vault.";
    }
    return message;
  }

  async function getProvider(providerOverride = null) {
    const walletProvider = providerOverride || selectedWalletProvider || window.ethereum;
    if (!walletProvider?.request) throw new Error(getWalletNotFoundMessage());
    await walletProvider.request({ method: "eth_requestAccounts" });
    try {
      await walletProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: OPN_CHAIN_ID_HEX }] });
    } catch (switchError) {
      if (switchError?.code === 4902) {
        await walletProvider.request({ method: "wallet_addEthereumChain", params: [OPN_TESTNET] });
      } else {
        throw switchError;
      }
    }
    return new ethers.BrowserProvider(walletProvider);
  }

  async function connectWallet(wallet) {
    try {
      const walletName = getWalletDisplayName(wallet);
      const walletProvider = isMetaMaskWallet(wallet) ? findMetaMaskProvider([wallet, ...detectedWallets]) : getWalletProvider(wallet);
      if (!walletProvider?.request) throw new Error(getWalletNotFoundMessage());
      setSelectedWalletProvider(walletProvider);
      setSelectedWalletName(walletName);
      if (import.meta.env.DEV) {
        console.log("Selected wallet:", walletName);
        console.log("Selected provider:", walletProvider);
      }
      const provider = await getProvider(walletProvider);
      const signer = await provider.getSigner();
      const selectedAccount = await signer.getAddress();
      setAccount(selectedAccount);
      await refreshWalletBalance(selectedAccount, walletProvider);
      setWalletDropdownOpen(false);
      setWalletSelectorOpen(false);
      notify("Wallet connected", `Connected ${walletName} to OPN Testnet.`, "success");
      addActivity("Wallet Connected", `Connected ${shortAddress(selectedAccount)}.`);
    } catch (error) {
      reportError(error);
    }
  }

  async function copyAddress() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      notify("Address copied", shortAddress(account), "success");
      addActivity("Address Copied", `Copied ${shortAddress(account)} to clipboard.`);
    } catch (error) {
      reportError(error);
    }
  }

  async function copyText(value, message = "Copied.") {
    try {
      await navigator.clipboard.writeText(value);
      notify(message, "", "success");
      if (message.toLowerCase().includes("proof")) {
        addActivity("Proof Copied", "Proof summary copied to clipboard.");
      } else if (message.toLowerCase().includes("address copied")) {
        addActivity("Address Copied", "Copied proof address to clipboard.");
      }
    } catch (error) {
      reportError(error);
    }
  }

  function openWalletExplorer() {
    if (!account) return;
    window.open(`https://testnet.iopn.tech/address/${account}`, "_blank", "noopener,noreferrer");
  }

  function openPublicProfile() {
    window.open("https://builders.iopn.tech/dashboard/profile", "_blank", "noopener,noreferrer");
  }

  function openWalletSelector() {
    const refreshedWallets = getInjectedWallets();
    if (isMobileUserAgent() && !refreshedWallets.some((wallet) => getWalletProvider(wallet)?.request) && !window.ethereum?.request) {
      notify("Mobile wallet required", getWalletNotFoundMessage(), "error");
    }
    setDetectedWallets((currentWallets) => prepareWalletList([...currentWallets, ...refreshedWallets]));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    }
    setWalletSelectorOpen(true);
  }

  async function signOutWallet() {
    try {
      const walletProvider = selectedWalletProvider || window.ethereum;
      if (walletProvider?.request) {
        await walletProvider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      }
    } catch {
      // Some wallets do not support permission revocation; local state still signs out.
    } finally {
      setAccount("");
      setWalletBalance("");
      setIsBalanceLoading(false);
      setSelectedWalletProvider(null);
      setSelectedWalletName("");
      setForm((currentForm) => ({
        ...currentForm,
        recipient: currentForm.recipient && account && currentForm.recipient.toLowerCase() === account.toLowerCase() ? "" : currentForm.recipient
      }));
      setFormChangedAfterReceipt(true);
      setWalletDropdownOpen(false);
      notify("Wallet disconnected", "Local wallet session cleared.", "success");
      addActivity("Wallet Disconnected", "Local wallet session cleared.");
    }
  }

  async function getContract() {
    if (!contractReady) throw new Error("Contract address missing. Set VITE_VESTFLOW_ADDRESS after deployment.");
    const provider = await getProvider();
    const signer = await provider.getSigner();
    return new Contract(VESTFLOW_ADDRESS, ABI, signer);
  }

  function getReadContract() {
    const provider = new JsonRpcProvider(OPN_TESTNET.rpcUrls[0]);
    return new Contract(VESTFLOW_ADDRESS, ABI, provider);
  }

  function mapVaultInfo(data, claimable, vested) {
    return {
      creator: data.creator,
      recipient: data.recipient,
      amount: formatEther(data.amount),
      amountRaw: data.amount.toString(),
      claimed: formatEther(data.claimed),
      claimedRaw: data.claimed.toString(),
      start: Number(data.start),
      cliff: Number(data.cliff),
      duration: Number(data.duration),
      cancelled: data.cancelled,
      title: data.title,
      claimable: formatEther(claimable),
      claimableRaw: claimable.toString(),
      vested: formatEther(vested),
      vestedRaw: vested.toString()
    };
  }

  async function readVaultInfo(contract, selectedVaultId) {
    const data = await contract.vaults(selectedVaultId);
    const claimable = await contract.claimableAmount(selectedVaultId);
    const vested = await contract.vestedAmount(selectedVaultId);
    return {
      info: mapVaultInfo(data, claimable, vested),
      claimable
    };
  }

  async function loadSelectedVaultData(selectedVaultId = vaultId.trim()) {
    if (!selectedVaultId) {
      setVaultInfo(null);
      return null;
    }
    if (!/^\d+$/.test(selectedVaultId)) {
      setVaultInfo(null);
      return null;
    }

    try {
      setIsVaultLoading(true);
      const contract = getReadContract();
      const { info } = await readVaultInfo(contract, selectedVaultId);
      setVaultInfo(info);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      return info;
    } catch (error) {
      setVaultInfo(null);
      reportError(error);
      return null;
    } finally {
      setIsVaultLoading(false);
    }
  }

  async function loadMyVaults(showToast = true) {
    if (!account) {
      setMyVaults([]);
      setVaultLoadError("");
      setShowVaultLoadSlowHint(false);
      return;
    }

    let slowHintTimer;
    try {
      setIsVaultListLoading(true);
      setVaultLoadError("");
      setShowVaultLoadSlowHint(false);
      slowHintTimer = window.setTimeout(() => setShowVaultLoadSlowHint(true), 2000);
      const contract = getReadContract();
      const nextId = await contract.nextVaultId();
      setNextVaultId(nextId.toString());
      const totalVaults = Number(nextId);
      const accountLower = account.toLowerCase();
      const vaults = [];

      for (let index = 0; index < totalVaults; index += 1) {
        try {
          const { info } = await readVaultInfo(contract, String(index));
          const isRecipient = info.recipient?.toLowerCase() === accountLower;
          const isCreator = info.creator?.toLowerCase() === accountLower;
          if (isRecipient || isCreator) {
            vaults.push({ id: String(index), ...info });
          }
        } catch {
          // Skip vault IDs that cannot be read without mutating UI state.
        }
      }

      setMyVaults(vaults);
      if (vaultId.trim() && /^\d+$/.test(vaultId.trim())) {
        await loadSelectedVaultData(vaultId.trim());
      }
      if (showToast) notify("Vault list refreshed.", "", "success");
    } catch (error) {
      setVaultLoadError("Unable to load vaults. You can still enter a Vault ID manually.");
      reportError(error);
    } finally {
      window.clearTimeout(slowHintTimer);
      setIsVaultListLoading(false);
      setShowVaultLoadSlowHint(false);
    }
  }

  function selectVault(vault) {
    setVaultId(vault.id);
    setVaultInfo(vault);
    loadSelectedVaultData(vault.id);
  }

  function updateAmountFromBalance(percent) {
    if (!hasKnownWalletBalance || parsedWalletBalance <= 0) return;
    const nextAmount = parsedWalletBalance * (percent / 100);
    updateLockForm({ amount: formatAmountInput(nextAmount) });
  }

  function setMaxAmount() {
    if (!hasKnownWalletBalance || parsedWalletBalance <= 0) return;
    const nextAmount = parsedWalletBalance > GAS_BUFFER_OPN ? parsedWalletBalance - GAS_BUFFER_OPN : 0;
    if (nextAmount <= 0) {
      notify("Not enough balance after gas buffer.", "", "error");
      return;
    }
    updateLockForm({ amount: formatAmountInput(nextAmount) });
  }

  function applyDurationPreset(days) {
    setDurationPreset(`${days} days`);
    updateLockForm({ releaseDate: getFutureDateTimeLocal(days) });
  }

  function selectCustomDuration() {
    setDurationPreset("custom");
    setFormChangedAfterReceipt(true);
    releaseDateInputRef.current?.focus();
  }

  function updateAmountInput(value) {
    updateLockForm({ amount: value.replace(",", ".") });
  }

  async function loadLiveContractData(manual = false) {
    if (!contractReady) {
      if (manual) notify("Transaction failed", "Contract address is not configured.", "error");
      return;
    }

    try {
      if (manual) {
        setPendingAction("refresh");
        notify("Refreshing contract data", "Reading latest OPN Testnet state.");
      }
      const contract = getReadContract();
      const nextId = await contract.nextVaultId();
      setNextVaultId(nextId.toString());
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      const selectedVaultId = vaultId.trim();
      if (!selectedVaultId) {
        setVaultInfo(null);
      } else if (/^\d+$/.test(selectedVaultId)) {
        const { info } = await readVaultInfo(contract, selectedVaultId);
        setVaultInfo(info);
      } else {
        setVaultInfo(null);
      }
      if (manual) {
        notify("Contract data refreshed", "Live contract reader updated.", "success");
        addActivity("Contract Data Refreshed", `Next Vault ID: ${nextId.toString()}.`);
      }
    } catch (error) {
      reportError(error);
    } finally {
      if (manual) setPendingAction("");
    }
  }

  function getLockSeconds() {
    if (!form.releaseDate) throw new Error("Release date must be in the future.");
    const releaseTime = new Date(form.releaseDate).getTime();
    if (!Number.isFinite(releaseTime)) throw new Error("Release date must be in the future.");
    const seconds = Math.floor((releaseTime - Date.now()) / 1000);
    if (seconds <= 0) throw new Error("Release date must be in the future.");
    return seconds;
  }

  function validateLockForm() {
    const selectedRecipient = useCustomRecipient ? form.recipient.trim() : account;
    const selectedAmount = normalizeDecimalInput(form.amount);
    if (!selectedRecipient) throw new Error(useCustomRecipient ? "Recipient address is required." : "Connect wallet first.");
    if (!isAddress(selectedRecipient)) throw new Error("Invalid recipient address.");
    const parsedAmount = Number(selectedAmount);
    if (!selectedAmount || !/^\d*\.?\d+$/.test(selectedAmount) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Amount must be greater than 0.");
    if (hasKnownWalletBalance && parsedAmount > parsedWalletBalance) throw new Error("Amount exceeds wallet balance.");
    return {
      lockSeconds: getLockSeconds(),
      recipient: selectedRecipient,
      amount: selectedAmount
    };
  }

  function getValidVaultId() {
    const selectedVaultId = vaultId.trim();
    if (!selectedVaultId) throw new Error("Enter a Vault ID first.");
    if (!/^\d+$/.test(selectedVaultId)) throw new Error("Vault ID must be a valid number.");
    return selectedVaultId;
  }

  async function createVault() {
    try {
      if (!account) throw new Error("Connect wallet first.");
      if (assetTab !== "native") throw new Error("ERC-20 support is coming soon. This contract currently supports native OPN only.");
      const { lockSeconds, recipient, amount } = validateLockForm();
      const cliffSeconds = BigInt(form.lockupStyle === "timelock" ? lockSeconds : 0);
      const durationSeconds = BigInt(lockSeconds);
      const title = form.note.trim() || "VestFlow Lock";

      setPendingAction("create");
      notify("Creating lock", "Confirm the transaction in your wallet.");
      const contract = await getContract();
      const predictedVaultId = (await contract.nextVaultId()).toString();
      const tx = await contract.createVault(recipient, cliffSeconds, durationSeconds, title, {
        value: parseEther(amount)
      });
      notify("Transaction submitted", shortAddress(tx.hash));
      await tx.wait();

      setProofReceipt({
        vaultId: predictedVaultId,
        recipient,
        amount,
        lockupStyle: form.lockupStyle === "timelock" ? "Simple Timelock" : "Linear Vesting",
        releaseDate: form.releaseDate,
        txHash: tx.hash
      });
      setFormChangedAfterReceipt(false);
      setVaultId(predictedVaultId);
      notify("Vault created successfully", `Vault ID: ${predictedVaultId}`, "success");
      addActivity("Vault Created", `Vault ID ${predictedVaultId} - ${amount} OPN locked for ${shortAddress(recipient)}.`, tx.hash);
      await refreshWalletBalance(account);
      await loadMyVaults(false);
      await loadLiveContractData(false);
    } catch (error) {
      reportError(error);
    } finally {
      setPendingAction("");
    }
  }

  async function claimVault() {
    try {
      if (!account) throw new Error("Connect wallet first.");
      const selectedVaultId = getValidVaultId();
      setPendingAction("claim");
      notify("Claiming vault", `Vault ID ${selectedVaultId}.`);
      if (import.meta.env.DEV) {
        console.log("Claiming vault:", selectedVaultId, "with account:", account);
      }

      const readContract = getReadContract();
      const claimable = await readContract.claimableAmount(selectedVaultId);
      if (claimable === 0n) {
        throw new Error("Nothing available to claim yet.");
      }

      const vault = await readContract.vaults(selectedVaultId);
      if (vault.recipient?.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Only the recipient wallet can claim this vault.");
      }

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Only the recipient wallet can claim this vault.");
      }

      const contract = new Contract(VESTFLOW_ADDRESS, ABI, signer);
      const tx = await contract.claim(selectedVaultId);
      notify("Claim transaction submitted", shortAddress(tx.hash));
      const receipt = await tx.wait();
      if (receipt?.status !== 1) {
        throw new Error("Claim transaction failed.");
      }
      notify("Claim successful.", `Tx: ${shortAddress(tx.hash)}`, "success");
      addActivity("Claim Executed", `Vault ${selectedVaultId} claimed successfully.`, tx.hash);
      await refreshWalletBalance(account);
      await loadSelectedVaultData(selectedVaultId);
      await loadMyVaults(false);
      await loadLiveContractData(false);
    } catch (error) {
      reportError(new Error(normalizeWalletError(error)));
    } finally {
      setPendingAction("");
    }
  }

  return (
    <>
      <aside className="sidebar">
        <button className="nav-brand brand-row" onClick={() => setActivePage("home")} aria-label="VestFlow home">
          <span className="brand-logo">
            <img src="/iopn-logo.png" alt="VestFlow logo" />
          </span>
          <span className="brand-copy">
            <strong className="brand-title">VestFlow Protocol</strong>
            <small className="brand-subtitle">IOPn / OPN Testnet</small>
          </span>
        </button>
        <div className="menu-label">MAIN</div>
        <nav className="nav-links" aria-label="Page sections">
          {navItems.map(({ label, id, Icon }) => (
            <button key={id} className={activePage === id ? "nav-item active" : "nav-item"} onClick={() => setActivePage(id)}>
              <Icon aria-hidden="true" size={17} strokeWidth={2.35} />
              <span>{label}</span>
              <span className="active-dot" aria-hidden="true" />
            </button>
          ))}
        </nav>
      </aside>

      <header className="top-controls" aria-label="Wallet and display controls">
        <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle color theme">
          {theme === "dark" ? <Sun aria-hidden="true" size={19} /> : <Moon aria-hidden="true" size={19} />}
        </button>
        <div className="wallet-menu" ref={walletMenuRef}>
          <button
            className={account ? "wallet-button connected" : "wallet-button"}
            onClick={account ? () => setWalletDropdownOpen((isOpen) => !isOpen) : openWalletSelector}
            aria-expanded={account ? walletDropdownOpen : undefined}
            aria-haspopup={account ? "menu" : undefined}
          >
            {account ? (
              <>
                <span className="status-dot" />
                <span className="wallet-balance-pill">
                  <img src={OPN_BALANCE_LOGO} alt="" />
                  <span>{displayedWalletBalance} OPN</span>
                </span>
                <span>{shortAddress(account)}</span>
                <ChevronDown aria-hidden="true" size={16} />
              </>
            ) : (
              "Connect Wallet"
            )}
          </button>
          {account && walletDropdownOpen && (
            <div className="wallet-dropdown" role="menu">
              <span className="dropdown-label">LINKED WALLET</span>
              <div className="dropdown-address">
                <Wallet aria-hidden="true" size={18} />
                <code>{selectedWalletName ? `${selectedWalletName}: ${account}` : account}</code>
              </div>
              <div className="dropdown-balance">
                <img src={OPN_BALANCE_LOGO} alt="" />
                <div>
                  <span>OPN Balance</span>
                  <strong>{isBalanceLoading ? "..." : `${walletBalance || "--"} OPN`}</strong>
                </div>
              </div>
              <button onClick={copyAddress} role="menuitem"><Copy aria-hidden="true" size={17} />Copy address</button>
              <button onClick={openWalletExplorer} role="menuitem"><ExternalLink aria-hidden="true" size={17} />View on explorer</button>
              <button onClick={openPublicProfile} role="menuitem"><Info aria-hidden="true" size={17} />Public profile</button>
              <button className="sign-out" onClick={signOutWallet} role="menuitem"><LogOut aria-hidden="true" size={17} />Sign out</button>
            </div>
          )}
        </div>
      </header>

      {walletSelectorOpen && !account && (
        <div className="wallet-modal-backdrop" role="presentation" onClick={() => setWalletSelectorOpen(false)}>
          <div className="wallet-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-selector-title" onClick={(event) => event.stopPropagation()}>
            <div className="wallet-modal-heading">
              <span className="dropdown-label">CONNECT WALLET</span>
              <h2 id="wallet-selector-title">Select wallet</h2>
            </div>
            <div className="wallet-choice-list">
              {detectedWallets.length ? detectedWallets.map((wallet) => (
                <button key={getWalletDedupeKey(wallet)} onClick={() => connectWallet(wallet)}>
                  {getWalletIcon(wallet) ? (
                    <img src={getWalletIcon(wallet)} alt="" />
                  ) : (
                    <Wallet aria-hidden="true" size={18} />
                  )}
                  <span>
                    <strong>{getWalletDisplayName(wallet)}</strong>
                    <small>{wallet?.info?.rdns || wallet?.rdns || "Detected wallet provider"}</small>
                  </span>
                </button>
              )) : (
                <div className="wallet-empty-state">{getWalletNotFoundMessage()}</div>
              )}
              {isMobileBrowser && !hasAvailableWalletProvider && (
                <div className="mobile-wallet-help">
                  <strong>Mobile wallet required</strong>
                  <p>Open VestFlow inside MetaMask or OKX Wallet in-app browser to connect on mobile.</p>
                  <div className="mobile-wallet-actions">
                    <button onClick={() => copyText(DAPP_URL, "dApp URL copied.")}>Copy dApp URL</button>
                    <a href={METAMASK_DAPP_URL} target="_blank" rel="noreferrer">Open MetaMask</a>
                  </div>
                  <p className="okx-mobile-note">OKX Wallet: open OKX Wallet app, go to Discover / Browser, then paste {DAPP_URL}.</p>
                </div>
              )}
            </div>
            <button className="wallet-modal-cancel" onClick={() => setWalletSelectorOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <strong>{toast.title}</strong>
            {toast.description && <span>{toast.description}</span>}
          </div>
        ))}
      </div>

      <main className="page">
        <div key={activePage} className="page-transition">
        {activePage === "home" && (
          <>
        <section className="hero page-panel reveal reveal-up" data-reveal>
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-orb" aria-hidden="true" />
          <div className="hero-particles" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="hero-vault" aria-hidden="true">
            <div className="vault-halo" />
            <div className="vault-shell">
              <div className="vault-ring" />
              <div className="vault-lock">
                <span />
              </div>
            </div>
          </div>
          <div className="hero-content">
            <div className="badge">OPN Builders / Testnet DeFi Infrastructure</div>
            <div className="hero-brand">
              <h1>
                <span>VestFlow</span>
                <span className="gradient-title">Protocol</span>
              </h1>
            </div>
            <p>
              A premium dashboard for locking native OPN into verifiable timelocks
              and vesting schedules on OPN Testnet.
            </p>
            <div className="actions">
              <button onClick={() => setActivePage("lock")}>Lock Assets</button>
              <a href={EXPLORER_URL} target="_blank" rel="noreferrer">View Contract</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </div>
        </section>

        <section className="warning">
          <strong>Testnet demo only.</strong> Do not send mainnet funds.
        </section>

        {!contractReady && (
          <section className="warning">
            Contract address is not set yet. Deploy the contract, then add it to <code>VITE_VESTFLOW_ADDRESS</code>.
          </section>
        )}

        <section className="quick-stats" data-reveal>
          <div className="stat-card reveal reveal-scale" style={{ "--delay": "0ms" }}>
            <span className="stat-icon"><Globe aria-hidden="true" /></span>
            <div className="stat-copy">
              <span className="stat-label">Network</span>
              <strong className="stat-value">OPN Testnet</strong>
            </div>
          </div>
          <div className="stat-card reveal reveal-scale" style={{ "--delay": "80ms" }}>
            <span className="stat-icon"><Coins aria-hidden="true" /></span>
            <div className="stat-copy">
              <span className="stat-label">Asset</span>
              <strong className="stat-value">Native OPN</strong>
            </div>
          </div>
          <div className="stat-card reveal reveal-scale" style={{ "--delay": "160ms" }}>
            <span className="stat-icon"><FileCheck aria-hidden="true" /></span>
            <div className="stat-copy">
              <span className="stat-label">Contract</span>
              <strong className="stat-value">Live</strong>
            </div>
          </div>
          <div className="stat-card reveal reveal-scale" style={{ "--delay": "240ms" }}>
            <span className="stat-icon"><Activity aria-hidden="true" /></span>
            <div className="stat-copy">
              <span className="stat-label">Status</span>
              <strong className="stat-value">MVP</strong>
            </div>
          </div>
        </section>
          </>
        )}

        {activePage === "lock" && (
          <>
        <section className="lock-page page-panel">
            <div className="card lock-card reveal reveal-up" data-reveal>
              <div className="card-heading">
                <p className="section-kicker">Main Product Dashboard</p>
                <h2><span>Lock</span> <span className="gradient-title">Assets</span></h2>
                <p>Secure native OPN under timelocks or vesting schedules.</p>
              </div>

              <div className="lock-form-grid">
                <div className="lock-form-column">
                  <p className="form-group-title">Recipient & Amount</p>

                  <div className="tabs" role="tablist" aria-label="Asset type">
                    <button className={assetTab === "native" ? "active" : ""} onClick={() => {
                      setAssetTab("native");
                      setFormChangedAfterReceipt(true);
                    }}>Native OPN</button>
                    <button className={assetTab === "erc20" ? "active" : ""} onClick={() => {
                      setAssetTab("erc20");
                      setFormChangedAfterReceipt(true);
                    }} aria-disabled="true">
                      ERC-20 Token <span>Coming soon</span>
                    </button>
                  </div>

                  {assetTab === "erc20" && (
                    <div className="coming-soon">
                      ERC-20 locks require a new contract deployment. The current VestFlow contract supports native OPN only.
                    </div>
                  )}

                  <div className="form-section">
                    <div className="section-row">
                      <label>Recipient</label>
                      <button
                        className="text-toggle"
                        type="button"
                        onClick={() => {
                          setUseCustomRecipient((enabled) => !enabled);
                          setFormChangedAfterReceipt(true);
                        }}
                      >
                        {useCustomRecipient ? "Use connected wallet" : "Send to another recipient"}
                      </button>
                    </div>
                    {!useCustomRecipient ? (
                      <div className="recipient-card">
                        <span>Recipient</span>
                        <strong>{account ? "Connected wallet" : "Connect wallet to set recipient."}</strong>
                        {account ? <code>{shortAddress(account)}</code> : null}
                      </div>
                    ) : (
                      <>
                        <input value={form.recipient} onChange={(e) => updateLockForm({ recipient: e.target.value })} placeholder="0x..." />
                        <small className="field-hint">Use a contributor, grant, team, or campaign recipient wallet.</small>
                      </>
                    )}
                  </div>

                  <div className="form-section">
                    <div className="section-row">
                      <label>Amount</label>
                      <span className="balance-label">Balance: {isBalanceLoading ? "..." : `${formatWalletBalance(walletBalance)} OPN`}</span>
                    </div>
                    <input
                      inputMode="decimal"
                      min="0"
                      step="0.0001"
                      value={form.amount}
                      onChange={(e) => updateAmountInput(e.target.value)}
                      onBlur={() => updateLockForm({ amount: formatAmountInput(normalizeDecimalInput(form.amount)) || form.amount })}
                      placeholder="0.01"
                    />
                    {hasKnownWalletBalance ? (
                      <div className="amount-tools">
                        <input
                          className="amount-slider"
                          type="range"
                          min="0"
                          max="100"
                          value={amountSliderValue}
                          onChange={(e) => updateAmountFromBalance(Number(e.target.value))}
                          aria-label="Amount percentage of wallet balance"
                        />
                        <div className="chip-row">
                          <button type="button" onClick={() => updateAmountFromBalance(25)}>25%</button>
                          <button type="button" onClick={() => updateAmountFromBalance(50)}>50%</button>
                          <button type="button" onClick={() => updateAmountFromBalance(75)}>75%</button>
                          <button type="button" onClick={setMaxAmount}>Max</button>
                        </div>
                      </div>
                    ) : (
                      <small className="field-hint">Balance tools appear after wallet balance loads.</small>
                    )}
                  </div>
                </div>

                <div className="lock-form-column">
                  <p className="form-group-title">Vesting Schedule</p>

                  <label>Lockup Style</label>
                  <select value={form.lockupStyle} onChange={(e) => updateLockForm({ lockupStyle: e.target.value })}>
                    <option value="timelock">Simple Timelock</option>
                    <option value="linear">Linear Vesting</option>
                  </select>

                  <label>Release / End Date</label>
                  <input ref={releaseDateInputRef} type="datetime-local" value={form.releaseDate} onChange={(e) => {
                    setDurationPreset("custom");
                    updateLockForm({ releaseDate: e.target.value });
                  }} />
                  <div className="chip-row duration-presets">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={durationPreset === preset.label ? "active" : ""}
                        onClick={() => applyDurationPreset(preset.days)}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button type="button" className={durationPreset === "custom" ? "active" : ""} onClick={selectCustomDuration}>Custom</button>
                  </div>
                  {durationPreset === "custom" && (
                    <small className="field-hint duration-helper">Custom date selected. Choose your release date manually.</small>
                  )}

                  <label>Description / Note</label>
                  <select value={noteOption} onChange={(e) => handleNoteOptionChange(e.target.value)}>
                    <option value="" disabled>Choose purpose</option>
                    {NOTE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value={CUSTOM_NOTE_OPTION}>{CUSTOM_NOTE_OPTION}</option>
                  </select>
                  {noteOption === CUSTOM_NOTE_OPTION && (
                    <textarea
                      className="custom-note"
                      value={form.note}
                      onChange={(e) => updateLockForm({ note: e.target.value })}
                      placeholder="Contributor grant, team unlock, DAO reward..."
                    />
                  )}

                  {showLockPreview && (
                    <div className="lock-preview">
                      <span className="dropdown-label">Preview</span>
                      <div><span>Recipient</span><strong>{recipientAddress ? (useCustomRecipient ? shortAddress(recipientAddress) : "Connected wallet") : "Connect wallet to set recipient"}</strong></div>
                      <div><span>Amount</span><strong>{formatAmountInput(amountValue) || "0"} OPN</strong></div>
                      <div><span>Lockup</span><strong>{lockupLabel}</strong></div>
                      <div><span>Release</span><strong>{form.releaseDate || "Not set"}</strong></div>
                      <div><span>Purpose / Note</span><strong>{previewNote}</strong></div>
                      <p><b>Estimated behavior:</b> {lockupBehavior}</p>
                    </div>
                  )}
                  <button className="primary-action" onClick={createVault} disabled={assetTab !== "native" || Boolean(pendingAction)}>
                    {pendingAction === "create" ? "Creating Lock..." : "Create Secure Lock"}
                  </button>
                </div>
              </div>
            </div>
        </section>

        {proofReceipt && (
          <section className="proof-receipt reveal reveal-up" data-reveal>
            <div>
              <p className="section-kicker">Proof Receipt</p>
              <h2><span>Vault creation</span> <span className="gradient-title">verified</span></h2>
            </div>
            <div className="receipt-grid">
              <div><span>Vault ID</span><strong>{proofReceipt.vaultId}</strong></div>
              <div><span>Recipient</span><code>{proofReceipt.recipient}</code></div>
              <div><span>Amount</span><strong>{proofReceipt.amount} OPN</strong></div>
              <div><span>Lockup style</span><strong>{proofReceipt.lockupStyle}</strong></div>
              <div><span>Release date</span><strong>{proofReceipt.releaseDate}</strong></div>
              <div><span>Transaction hash</span><code>{shortAddress(proofReceipt.txHash)}</code></div>
            </div>
            <div className="actions compact">
              <button onClick={() => {
                setVaultId(proofReceipt.vaultId);
                setActivePage("track");
              }}>Track this Vault</button>
              <a href={`https://testnet.iopn.tech/tx/${proofReceipt.txHash}`} target="_blank" rel="noreferrer">View transaction on OPN Explorer</a>
              <button onClick={() => copyText(`VestFlow Proof Receipt\nVault ID: ${proofReceipt.vaultId}\nRecipient: ${proofReceipt.recipient}\nAmount: ${proofReceipt.amount} OPN\nLockup style: ${proofReceipt.lockupStyle}\nRelease date: ${proofReceipt.releaseDate}\nTransaction: https://testnet.iopn.tech/tx/${proofReceipt.txHash}`, "Proof summary copied.")}>Copy Proof Summary</button>
            </div>
          </section>
        )}
          </>
        )}

        {activePage === "track" && (
          <>
        <section className="claim-center page-panel reveal reveal-up" data-reveal>
          <div className="claim-center-heading">
            <h2><span>Track</span> <span className="gradient-title">& Claim</span></h2>
            <p>Select a vault, review status, and claim vested OPN.</p>
            <div className="claim-steps" aria-label="Claim flow">
              <span className="active">1 Select Vault</span>
              <span>2 Review Status</span>
              <span>3 Claim OPN</span>
            </div>
          </div>

          <div className="card claim-center-card compact-panel reveal reveal-up" data-reveal>
            <div className="claim-center-card-grid">
              <div className="vault-selection-panel reveal reveal-left" data-reveal>
                <div className="card-heading">
                  <h3>My Vaults</h3>
                  <p>Select a vault linked to your connected wallet.</p>
                </div>
                <div className="my-vaults-toolbar">
                  <span>{account ? `${myVaults.length} vault${myVaults.length === 1 ? "" : "s"} found` : "Wallet required"}</span>
                  <button type="button" onClick={() => loadMyVaults(true)} disabled={!account || isVaultListLoading}>
                    {isVaultListLoading ? "Refreshing..." : "Refresh My Vaults"}
                  </button>
                </div>
                <div className="my-vaults-list">
                  {!account ? (
                    <div className="empty-state compact-empty">Connect wallet to load your vaults.</div>
                  ) : isVaultListLoading ? (
                    <div className="vault-loading-state">
                      <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
                      <strong>Loading your vaults</strong>
                      <p>Reading vault data from OPN Testnet.</p>
                      {showVaultLoadSlowHint ? <small>This may take a few seconds because VestFlow is reading vaults from the contract.</small> : null}
                    </div>
                  ) : vaultLoadError ? (
                    <div className="empty-state compact-empty">{vaultLoadError}</div>
                  ) : myVaults.length ? (
                    myVaults.map((vault) => {
                      const status = getVaultStatusDetails(vault);
                      return (
                        <button
                          key={vault.id}
                          type="button"
                          className={vaultId.trim() === vault.id ? "my-vault-item active" : "my-vault-item"}
                          onClick={() => selectVault(vault)}
                        >
                          <span>
                            <strong>Vault #{vault.id}</strong>
                            <small>{vault.title || "Untitled"}</small>
                          </span>
                          <span>
                            <strong>{vault.amount} OPN</strong>
                            <small>Claimable: {vault.claimable || "0.0"} OPN</small>
                          </span>
                          <span className={`status-badge ${status.tone}`}>{status.label}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="empty-state compact-empty">No vaults found for this wallet. Create a lock first or enter a Vault ID manually.</div>
                  )}
                </div>
                <div className="manual-vault-entry">
                  <label>Manual Vault ID</label>
                  <input value={vaultId} onChange={(e) => setVaultId(e.target.value)} placeholder="Enter Vault ID" />
                  <small className="field-hint">Manual entries auto-load after a short delay.</small>
                </div>
              </div>

              <div className="vault-details-panel reveal reveal-right" data-reveal>
                <div className="card-heading">
                  <h3>Vault Status</h3>
                  <p>Compact status and vesting summary for the selected vault.</p>
                </div>
                {isVaultLoading ? (
                  <div className="empty-state">Loading vault data...</div>
                ) : vaultInfo ? (
                  <TrackVaultDetails
                    vault={vaultInfo}
                    vaultId={vaultId}
                    onCopyRecipient={() => copyText(vaultInfo.recipient, "Recipient copied.")}
                  />
                ) : (
                  <div className="empty-state">Select a vault or enter a Vault ID.</div>
                )}
              </div>
            </div>
            <div className="claim-center-actions">
              <button
                className={!vaultId.trim() ? "soft-disabled" : ""}
                onClick={claimVault}
                disabled={Boolean(pendingAction)}
              >
                {pendingAction === "claim" ? "Claiming..." : "Claim Vault"}
              </button>
            </div>
          </div>

          <div className="track-claim-support-grid">
              <div className="card live-reader compact-panel compact-reader reveal reveal-up" data-reveal>
                <div className="card-heading">
                  <p className="section-kicker">Contract Summary</p>
                  <h2><span>OPN</span> <span className="gradient-title">Contract Data</span></h2>
                </div>
                <div className="reader-list compact-reader-list">
                  <div><span>Contract Status</span><strong>{contractStatus}</strong></div>
                  <div><span>Network</span><strong>OPN Testnet</strong></div>
                  <div><span>Selected Vault ID</span><strong>{vaultId || "None"}</strong></div>
                  <div><span>Claimable Amount</span><strong>{vaultInfo?.claimable || "0.0"} OPN</strong></div>
                  <div><span>Vested Amount</span><strong>{vaultInfo?.vested || "0.0"} OPN</strong></div>
                  <div><span>Contract</span><strong>{shortAddress(VESTFLOW_ADDRESS)}</strong><button onClick={() => copyText(VESTFLOW_ADDRESS, "Contract address copied.")}><Copy aria-hidden="true" size={15} />Copy</button></div>
                  <div><span>Last refreshed</span><strong>{lastRefreshed || "Not yet"}</strong></div>
                </div>
              </div>
          </div>

          <div className="card activity-feed activity-card compact-panel compact-activity protocol-events-bottom reveal reveal-up" data-reveal>
            <div className="activity-toggle-heading">
              <div>
                <h2>Protocol Events</h2>
                <p>Recent wallet and vault activity</p>
              </div>
              <span>{activity.length} latest</span>
              <button type="button" onClick={() => setActivityExpanded((expanded) => !expanded)}>
                {activityExpanded ? "Hide" : "Show"}
              </button>
            </div>
            {activityExpanded && (
              activity.length ? (
                <div className="activity-list">
                  {activity.map((item) => (
                    <div key={item.id} className={item.txHash ? "activity-item has-link" : "activity-item"}>
                      <span className="activity-marker">
                        <ShieldCheck aria-hidden="true" size={15} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                        <time>{new Date(item.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                      </div>
                      {item.txHash && (
                        <a href={`https://testnet.iopn.tech/tx/${item.txHash}`} target="_blank" rel="noreferrer">
                          <ExternalLink aria-hidden="true" size={15} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty">No recent activity yet.</div>
              )
            )}
          </div>
        </section>
          </>
        )}

        {activePage === "proof" && (
        <section className="proof page-panel reveal reveal-up" data-reveal>
          <div className="proof-intro">
            <p className="section-kicker">On-chain proof</p>
            <h2><span>Live public deployment</span> <span className="gradient-title">on OPN Testnet</span></h2>
            <p>
              VestFlow is deployed with a public contract, deploy transaction,
              repository, and explorer links so builders can verify the protocol.
            </p>
          </div>
          <div className="proof-grid">
            <div className="reveal reveal-scale" style={{ "--delay": "0ms" }}>
              <span>Contract</span>
              <code>{VESTFLOW_ADDRESS}</code>
              <div className="proof-actions"><a href={EXPLORER_URL} target="_blank" rel="noreferrer">Open</a><button onClick={() => copyText(VESTFLOW_ADDRESS, "Contract address copied.")}><Copy aria-hidden="true" size={15} />Copy</button></div>
            </div>
            <div className="reveal reveal-scale" style={{ "--delay": "80ms" }}>
              <span>Deploy TX</span>
              <code>{DEPLOY_TX}</code>
              <div className="proof-actions"><a href={`https://testnet.iopn.tech/tx/${DEPLOY_TX}`} target="_blank" rel="noreferrer">Open</a><button onClick={() => copyText(DEPLOY_TX, "Deploy transaction copied.")}><Copy aria-hidden="true" size={15} />Copy</button></div>
            </div>
            <div className="reveal reveal-scale" style={{ "--delay": "160ms" }}>
              <span>Deployer</span>
              <code>{DEPLOYER}</code>
              <button onClick={() => copyText(DEPLOYER, "Deployer address copied.")}><Copy aria-hidden="true" size={15} />Copy</button>
            </div>
            <div className="reveal reveal-scale" style={{ "--delay": "240ms" }}>
              <span>GitHub</span>
              <code>github.com/ekypanawa/vestflow-protocol</code>
              <div className="proof-actions"><a href={GITHUB_URL} target="_blank" rel="noreferrer">Open</a><button onClick={() => copyText(GITHUB_URL, "Repository URL copied.")}><Copy aria-hidden="true" size={15} />Copy</button></div>
            </div>
            <a className="reveal reveal-scale" style={{ "--delay": "320ms" }} href={EXPLORER_URL} target="_blank" rel="noreferrer">
              <span>Explorer</span>
              <code>testnet.iopn.tech</code>
            </a>
          </div>
        </section>
        )}

        {activePage === "about" && (
          <>
        <section className="info-grid page-panel reveal reveal-up" data-reveal>
          <div className="info-card reveal reveal-scale" style={{ "--delay": "0ms" }}>
            <span>Problem</span>
            <h3>Manual payouts are slow and hard to verify.</h3>
            <p>Builder grants, team unlocks, and DAO distributions often depend on off-chain tracking that is hard for recipients to inspect.</p>
          </div>
          <div className="info-card reveal reveal-scale" style={{ "--delay": "80ms" }}>
            <span>Solution</span>
            <h3>Native OPN locks with public proof.</h3>
            <p>VestFlow maps a simple dashboard flow to on-chain vaults with claimable balances, explorer links, and copyable proof receipts.</p>
          </div>
          <div className="info-card reveal reveal-scale" style={{ "--delay": "160ms" }}>
            <span>Builder commitment</span>
            <h3>Shipping in public on OPN Testnet.</h3>
            <p>The MVP keeps the contract, deploy transaction, repository, and test guide visible so OPN Builders can evaluate real integration progress.</p>
          </div>
        </section>

        <section className="use-cases reveal reveal-up" data-reveal>
          <p className="section-kicker">Use cases</p>
          <h2><span>Built for</span> <span className="gradient-title">OPN ecosystem coordination</span></h2>
          <div className="feature-grid">
            <div className="reveal reveal-scale" style={{ "--delay": "0ms" }}><h3>Contributor rewards</h3><p>Stream grants or milestone rewards to builders with public vesting rules.</p></div>
            <div className="reveal reveal-scale" style={{ "--delay": "80ms" }}><h3>DAO allocations</h3><p>Give treasuries a lightweight path for transparent distribution programs.</p></div>
            <div className="reveal reveal-scale" style={{ "--delay": "160ms" }}><h3>Team unlocks</h3><p>Structure founder, core team, and advisor incentives with simple vault mechanics.</p></div>
            <div className="reveal reveal-scale" style={{ "--delay": "240ms" }}><h3>Hackathon prizes</h3><p>Distribute testnet demo funds through verifiable post-event unlock schedules.</p></div>
          </div>
        </section>
          </>
        )}

        {activePage === "guide" && (
          <>
        <section className="demo-guide page-panel reveal reveal-up" data-reveal>
          <p className="section-kicker">Demo Guide</p>
          <h2><span>How to test</span> <span className="gradient-title">this demo</span></h2>
          <ol>
            <li>Connect wallet</li>
            <li>Use OPN Testnet</li>
            <li>Enter recipient and amount</li>
            <li>Choose lock style</li>
            <li>Create Secure Lock</li>
            <li>Track Vault ID</li>
            <li>Check claimable amount</li>
            <li>Verify on OPN Explorer</li>
          </ol>
        </section>

        <section className="faq-grid" data-reveal>
          <div className="reveal reveal-scale" style={{ "--delay": "0ms" }}><h3>Is this mainnet?</h3><p>No. This is a testnet demo on OPN Testnet. Do not send mainnet funds.</p></div>
          <div className="reveal reveal-scale" style={{ "--delay": "80ms" }}><h3>What asset is supported?</h3><p>The current contract supports native OPN locks.</p></div>
          <div className="reveal reveal-scale" style={{ "--delay": "160ms" }}><h3>Is ERC-20 supported?</h3><p>Not yet. The ERC-20 tab is marked Coming Soon until a new contract is deployed.</p></div>
          <div className="reveal reveal-scale" style={{ "--delay": "240ms" }}><h3>Where is the contract?</h3><p><a href={EXPLORER_URL} target="_blank" rel="noreferrer">View it on OPN Explorer</a>.</p></div>
        </section>
          </>
        )}

        {activePage === "roadmap" && (
          <>
        <section className="roadmap page-panel reveal reveal-up" data-reveal>
          <p className="section-kicker">Roadmap</p>
          <h2><span className="gradient-title">Q1-Q4 2026</span></h2>
          <div className="timeline">
            <div className="reveal reveal-scale" style={{ "--delay": "0ms" }}>
              <span>Q1 2026</span>
              <h3>MVP and OPN Testnet deployment</h3>
              <ul>
                <li>Deploy VestFlow smart contract on OPN Testnet</li>
                <li>Support native OPN lock and vesting vaults</li>
                <li>Add vault creation, claim flow, and proof receipt</li>
                <li>Add multi-wallet connection and on-chain explorer links</li>
                <li>Build the first public dashboard for tracking vault status</li>
              </ul>
            </div>
            <div className="reveal reveal-scale" style={{ "--delay": "80ms" }}>
              <span>Q2 2026</span>
              <h3>Builder feedback and product refinement</h3>
              <ul>
                <li>Improve UX based on builder and community feedback</li>
                <li>Add better vault indexing and wallet-based vault discovery</li>
                <li>Improve vault analytics, claim status, and activity history</li>
                <li>Add public usage examples for contributors, grants, and community rewards</li>
                <li>Polish mobile experience and dashboard performance</li>
              </ul>
            </div>
            <div className="reveal reveal-scale" style={{ "--delay": "160ms" }}>
              <span>Q3 2026</span>
              <h3>Advanced distribution flows</h3>
              <ul>
                <li>Add DAO grant and contributor reward templates</li>
                <li>Explore multi-recipient vault creation</li>
                <li>Add richer dashboard data for teams and recipients</li>
                <li>Improve proof sharing for communities and grant programs</li>
                <li>Research reusable vault templates for ecosystem campaigns</li>
              </ul>
            </div>
            <div className="reveal reveal-scale" style={{ "--delay": "240ms" }}>
              <span>Q4 2026</span>
              <h3>Security, scalability, and expansion research</h3>
              <ul>
                <li>Prepare for security review and audit readiness</li>
                <li>Improve contract safety, validation, and edge-case handling</li>
                <li>Research ERC-20 support for future token vesting</li>
                <li>Explore mainnet readiness if OPN ecosystem conditions are ready</li>
                <li>Document integration paths for OPN builders and ecosystem partners</li>
              </ul>
            </div>
          </div>
        </section>
        <section className="vision-card reveal reveal-up" data-reveal>
          <p className="section-kicker">Long-term Vision</p>
          <h2><span>Reusable fund distribution</span> <span className="gradient-title">for OPN builders</span></h2>
          <p>VestFlow aims to become a reusable fund distribution layer for the OPN ecosystem.</p>
          <p>The goal is to help builders, DAOs, grant programs, contributors, and communities manage vesting, rewards, treasury payouts, and launch unlocks transparently on-chain.</p>
          <p>Instead of relying on manual payments, private spreadsheets, or trust-based promises, VestFlow turns fund distribution into a verifiable smart contract workflow on OPN Chain.</p>
        </section>
          </>
        )}

        {activePage === "about" && (
        <section className="intro page-panel reveal reveal-up" data-reveal>
          <div>
            <p className="section-kicker">About / Builder Commitment</p>
            <h2><span>What is</span> <span className="gradient-title">VestFlow?</span></h2>
            <p>
              VestFlow is a builder-focused OPN Testnet product for transparent native OPN
              locks, proof receipts, and claimable fund tracking. The next milestones focus
              on indexing, analytics, templates, and security hardening.
            </p>
          </div>
          <div className="mini-stats">
            <div><strong>100%</strong><span>On-chain rules</span></div>
            <div><strong>0</strong><span>Custodians</span></div>
            <div><strong>OPN</strong><span>Native asset</span></div>
          </div>
        </section>
        )}
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
