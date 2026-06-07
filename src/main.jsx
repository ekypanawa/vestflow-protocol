import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ethers, Contract, JsonRpcProvider, formatEther, isAddress, parseEther } from "ethers";
import {
  Activity,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  FileCheck,
  Globe,
  Home,
  Info,
  Droplets,
  Hash,
  LockKeyhole,
  LogOut,
  Map,
  Moon,
  Menu,
  SearchCheck,
  ShieldCheck,
  Share2,
  Sun,
  Network,
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
const OPN_FAUCET_URL = "https://faucet.iopn.tech";
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  });
}

function formatDisplayAmount(value, decimals = 2) {
  const formatted = Number(value);
  if (!Number.isFinite(formatted) || formatted === 0) return Number(0).toFixed(decimals);
  return formatted.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatReceiptDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function buildProofSummary(receipt) {
  if (!receipt) return "";
  const lines = [
    "VestFlow Proof Receipt",
    "",
    `Vault #${receipt.vaultId} created on OPN Testnet`,
    `Recipient: ${shortAddress(receipt.recipient)}`,
    `Amount: ${receipt.amount} OPN`,
    `Lockup: ${receipt.lockupStyle}`,
    `Release: ${formatReceiptDate(receipt.releaseDate)}`,
    `Contract: ${shortAddress(VESTFLOW_ADDRESS)}`,
    "",
    `Demo: ${DAPP_URL}`,
    "",
    "#IOPn #OPNChain #BuildOnChain"
  ];
  return lines.join("\n");
}

function getHiddenClaimedVaultsKey(account) {
  return `vestflowHiddenClaimedVaults:${String(account || "").toLowerCase()}`;
}

function readHiddenClaimedVaults(account) {
  if (typeof window === "undefined" || !account) return new Set();
  try {
    const stored = JSON.parse(window.localStorage.getItem(getHiddenClaimedVaultsKey(account)) || "[]");
    return new Set(Array.isArray(stored) ? stored.map((value) => String(value)) : []);
  } catch {
    return new Set();
  }
}

function persistHiddenClaimedVaults(account, vaultIds) {
  if (typeof window === "undefined" || !account) return;
  const values = Array.from(vaultIds || []).map((value) => String(value));
  window.localStorage.setItem(getHiddenClaimedVaultsKey(account), JSON.stringify(values));
}

function isVaultFullyClaimed(vault) {
  if (!vault) return false;
  const amount = BigInt(vault.amountRaw || 0);
  const claimed = BigInt(vault.claimedRaw || 0);
  return amount > 0n && claimed >= amount;
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
  const date = new Date(Date.now() + 5 * 60 * 1000);
  date.setSeconds(0, 0);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("vestflow-theme") || "dark";
}

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1120px)").matches;
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

function getVaultReleaseTimestamp(vault) {
  if (!vault?.start || !vault?.duration) return 0;
  const releaseTimestamp = (Number(vault.start) + Number(vault.duration)) * 1000;
  return Number.isFinite(releaseTimestamp) && releaseTimestamp > 0 ? releaseTimestamp : 0;
}

function formatCountdown(targetTimestamp, now = Date.now()) {
  if (!targetTimestamp) return "Schedule unavailable";
  const remaining = Math.max(0, targetTimestamp - now);
  if (remaining <= 0) return "Unlocked";
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
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

function TrackVaultDetails({ vault, now }) {
  const status = vault?.cancelled
    ? { label: "Cancelled", tone: "claimed", helper: "" }
    : getVaultStatusDetails(vault);
  const isTimelock = getVaultLockupLabel(vault) === "Simple Timelock";
  const releaseTimestamp = getVaultReleaseTimestamp(vault);
  const countdownValue = formatCountdown(releaseTimestamp, now);
  const countdownLabel = isTimelock ? "Unlocks in" : "Fully vested in";
  const finalCountdownValue = countdownValue === "Unlocked" && !isTimelock ? "Fully vested" : countdownValue;
  const finalCountdownLabel = countdownValue === "Schedule unavailable" || countdownValue === "Unlocked" ? "Status" : countdownLabel;

  return (
    <div className="vault-summary">
      <div className="claim-summary">
        <div className="claim-summary-amount">
          <span>Claimable</span>
          <strong className="claimable-value">{formatDisplayAmount(vault.claimable, 2)} OPN</strong>
        </div>
        <div className="claim-summary-status">
          <span className={`status-badge ${status.tone}`}>{status.label}</span>
          {status.helper ? <small className={`status-helper ${status.tone}`}>{status.helper}</small> : null}
        </div>
      </div>
      <div className="vesting-countdown">
        <span className="countdown-label">{finalCountdownLabel}</span>
        <strong className="countdown-value">{finalCountdownValue}</strong>
      </div>
      <p className="vault-status-note">Vault data loads automatically from the selected Vault ID.</p>
    </div>
  );
}

function App() {
  const [account, setAccount] = useState("");
  const [, setStatus] = useState("Ready to build on OPN Testnet.");
  const [theme, setTheme] = useState(getInitialTheme);
  const [activePage, setActivePage] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
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
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [myVaults, setMyVaults] = useState([]);
  const [showClaimedVaults, setShowClaimedVaults] = useState(false);
  const [hiddenClaimedVaultIds, setHiddenClaimedVaultIds] = useState(new Set());
  const [isVaultListLoading, setIsVaultListLoading] = useState(false);
  const [vaultLoadError, setVaultLoadError] = useState("");
  const [showVaultLoadSlowHint, setShowVaultLoadSlowHint] = useState(false);
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [isAmountSliding, setIsAmountSliding] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [nextVaultId, setNextVaultId] = useState("...");
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [proofReceipt, setProofReceipt] = useState(null);
  const walletMenuRef = useRef(null);
  const mobileMoreMenuRef = useRef(null);
  const releaseDateInputRef = useRef(null);
  const proofSuccessRef = useRef(null);
  const roadmapTimelineRef = useRef(null);

  const contractReady = useMemo(() => Boolean(VESTFLOW_ADDRESS), []);
  const contractStatus = account ? "Connected" : "Not Connected";
  const isMobileBrowser = useMemo(() => isMobileUserAgent(), []);
  const displayedWalletBalance = isBalanceLoading ? "..." : formatWalletBalance(walletBalance);
  const recipientAddress = useCustomRecipient ? form.recipient.trim() : account;
  const amountValue = normalizeDecimalInput(form.amount);
  const parsedAmountValue = Number(amountValue);
  const parsedWalletBalance = Number(walletBalance);
  const hasKnownWalletBalance = Boolean(walletBalance) && Number.isFinite(parsedWalletBalance);
  const hasLowWalletBalance = Boolean(account) && !isBalanceLoading && hasKnownWalletBalance && parsedWalletBalance < 0.01;
  const amountSliderValue = hasKnownWalletBalance && parsedWalletBalance > 0 && Number.isFinite(parsedAmountValue)
    ? Math.min(100, Math.max(0, Math.round((parsedAmountValue / parsedWalletBalance) * 100)))
    : 0;
  const hasAvailableWalletProvider = useMemo(
    () => Boolean(selectedWalletProvider?.request || window.ethereum?.request || detectedWallets.some((wallet) => getWalletProvider(wallet)?.request)),
    [detectedWallets, selectedWalletProvider]
  );
  const visibleMyVaults = useMemo(() => {
    if (showClaimedVaults) return myVaults;
    return myVaults.filter((vault) => !isVaultFullyClaimed(vault) && !hiddenClaimedVaultIds.has(vault.id));
  }, [hiddenClaimedVaultIds, myVaults, showClaimedVaults]);
  const activeMyVaultCount = useMemo(() => myVaults.filter((vault) => !isVaultFullyClaimed(vault)).length, [myVaults]);
  const claimedMyVaultCount = Math.max(0, myVaults.length - activeMyVaultCount);
  const myVaultsShownLabel = showClaimedVaults
    ? `${visibleMyVaults.length} vault${visibleMyVaults.length === 1 ? "" : "s"} shown`
    : `${visibleMyVaults.length} active vault${visibleMyVaults.length === 1 ? "" : "s"}${claimedMyVaultCount ? ` · ${claimedMyVaultCount} claimed hidden` : ""}`;

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
    if (!mobileMoreOpen) return;

    const handleClickOutside = (event) => {
      if (mobileMoreMenuRef.current && !mobileMoreMenuRef.current.contains(event.target)) {
        setMobileMoreOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setMobileMoreOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMoreOpen]);

  useEffect(() => {
    setCountdownNow(Date.now());
    const releaseTimestamp = getVaultReleaseTimestamp(vaultInfo);
    if (!releaseTimestamp || releaseTimestamp <= Date.now()) return undefined;
    const intervalId = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [vaultId, vaultInfo?.start, vaultInfo?.duration]);

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
    if (!account) {
      setHiddenClaimedVaultIds(new Set());
      setShowClaimedVaults(false);
      return;
    }
    setHiddenClaimedVaultIds(readHiddenClaimedVaults(account));
    setShowClaimedVaults(false);
  }, [account]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const revealTargets = Array.from(
      document.querySelectorAll("[data-reveal]:not(.is-visible), .reveal:not(.is-visible), .reveal-up:not(.is-visible), .reveal-left:not(.is-visible), .reveal-right:not(.is-visible), .reveal-scale:not(.is-visible)")
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
  }, [activePage, activityExpanded, proofReceipt]);

  useEffect(() => {
    if (activePage !== "roadmap" || typeof window === "undefined") return;

    const timeline = roadmapTimelineRef.current;
    if (!timeline) return;

    const roadmapItems = Array.from(timeline.querySelectorAll(".roadmap-item"));
    let animationFrameId = 0;
    const updateProgress = () => {
      animationFrameId = 0;
      const rect = timeline.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const start = viewportHeight * 0.75;
      const end = viewportHeight - rect.height;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / Math.max(start - end, 1)));
      const roadmapNodes = roadmapItems
        .map((item) => item.querySelector(".roadmap-node"))
        .filter(Boolean);
      const firstNode = roadmapNodes[0];
      const lastNode = roadmapNodes[roadmapNodes.length - 1];

      if (firstNode && lastNode) {
        const firstRect = firstNode.getBoundingClientRect();
        const lastRect = lastNode.getBoundingClientRect();
        const lineTop = firstRect.top - rect.top + firstRect.height / 2;
        const lineBottom = lastRect.top - rect.top + lastRect.height / 2;
        const lineHeight = Math.max(1, lineBottom - lineTop);

        timeline.style.setProperty("--roadmap-line-top", `${lineTop}px`);
        timeline.style.setProperty("--roadmap-line-height", `${lineHeight}px`);
        timeline.style.setProperty("--roadmap-progress", `${progress}`);

        roadmapItems.forEach((item) => {
          const node = item.querySelector(".roadmap-node");
          if (!node) return;
          const nodeRect = node.getBoundingClientRect();
          const nodeCenter = nodeRect.top - rect.top + nodeRect.height / 2;
          const threshold = Math.min(1, Math.max(0, (nodeCenter - lineTop) / lineHeight));
          item.classList.toggle("is-reached", progress >= threshold);
        });
      }
    };

    const requestProgressUpdate = () => {
      if (!animationFrameId) animationFrameId = window.requestAnimationFrame(updateProgress);
    };

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReducedMotion) {
      const roadmapNodes = roadmapItems
        .map((item) => item.querySelector(".roadmap-node"))
        .filter(Boolean);
      const firstNode = roadmapNodes[0];
      const lastNode = roadmapNodes[roadmapNodes.length - 1];
      if (firstNode && lastNode) {
        const timelineRect = timeline.getBoundingClientRect();
        const firstRect = firstNode.getBoundingClientRect();
        const lastRect = lastNode.getBoundingClientRect();
        const lineTop = firstRect.top - timelineRect.top + firstRect.height / 2;
        const lineBottom = lastRect.top - timelineRect.top + lastRect.height / 2;
        timeline.style.setProperty("--roadmap-line-top", `${lineTop}px`);
        timeline.style.setProperty("--roadmap-line-height", `${Math.max(1, lineBottom - lineTop)}px`);
      }
      timeline.style.setProperty("--roadmap-progress", "1");
      roadmapItems.forEach((item) => item.classList.add("is-reached"));
      return undefined;
    }

    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate);
    requestProgressUpdate();

    return () => {
      window.removeEventListener("scroll", requestProgressUpdate);
      window.removeEventListener("resize", requestProgressUpdate);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, [activePage]);

  useEffect(() => {
    if (activePage === "proof") {
      setActivePage("guide");
    }
  }, [activePage]);

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

  async function copyProofSummary() {
    if (!proofReceipt) return;
    await copyText(buildProofSummary(proofReceipt), "Proof summary copied.");
  }

  async function shareProof() {
    if (!proofReceipt) return;
    const proofSummary = buildProofSummary(proofReceipt);
    if (navigator.share) {
      try {
        await navigator.share({
          title: "VestFlow Proof Receipt",
          text: proofSummary,
          url: DAPP_URL
        });
        notify("Proof shared.", "", "success");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await copyText(proofSummary, "Proof summary copied.");
  }

  function shareProofToX() {
    if (!proofReceipt) return;
    const tweetText = buildProofSummary(proofReceipt);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, "_blank", "noopener,noreferrer");
  }

  function drawRoundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function drawReceiptRow(context, label, value, y) {
    context.fillStyle = "rgba(248, 245, 255, 0.62)";
    context.font = "700 24px Arial";
    context.fillText(label.toUpperCase(), 140, y);
    context.fillStyle = "#fff7e8";
    context.font = "800 30px Arial";
    context.fillText(value, 420, y);
  }

  async function downloadReceiptPng() {
    if (!proofReceipt) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    if (!context) return;

    const writeText = (text, x, y, size = 32, color = "#f8f5ff", weight = 900, maxWidth = 620) => {
      context.save();
      context.shadowColor = "rgba(0, 0, 0, 0.68)";
      context.shadowBlur = 16;
      context.fillStyle = color;
      context.font = `${weight} ${size}px Arial`;
      let nextSize = size;
      while (context.measureText(text).width > maxWidth && nextSize > 18) {
        nextSize -= 2;
        context.font = `${weight} ${nextSize}px Arial`;
      }
      context.fillText(text, x, y);
      context.restore();
    };

    const background = context.createLinearGradient(0, 0, 1200, 800);
    background.addColorStop(0, "#07101f");
    background.addColorStop(0.45, "#120b25");
    background.addColorStop(1, "#061d2b");
    context.fillStyle = background;
    context.fillRect(0, 0, 1200, 800);

    context.strokeStyle = "rgba(255, 255, 255, 0.035)";
    context.lineWidth = 1;
    for (let x = 0; x <= 1200; x += 42) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 800);
      context.stroke();
    }
    for (let y = 0; y <= 800; y += 42) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(1200, y);
      context.stroke();
    }

    const purpleGlow = context.createRadialGradient(210, 120, 20, 210, 120, 340);
    purpleGlow.addColorStop(0, "rgba(168, 85, 247, 0.38)");
    purpleGlow.addColorStop(1, "rgba(168, 85, 247, 0)");
    context.fillStyle = purpleGlow;
    context.fillRect(0, 0, 560, 460);

    const blueGlow = context.createRadialGradient(925, 260, 20, 925, 260, 360);
    blueGlow.addColorStop(0, "rgba(56, 189, 248, 0.34)");
    blueGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
    context.fillStyle = blueGlow;
    context.fillRect(560, 0, 640, 620);

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.58)";
    context.shadowBlur = 44;
    context.shadowOffsetY = 26;
    drawRoundedRect(context, 70, 58, 1060, 684, 36);
    context.fillStyle = "rgba(11, 12, 28, 0.92)";
    context.fill();
    context.restore();

    const edge = context.createLinearGradient(70, 58, 1130, 742);
    edge.addColorStop(0, "rgba(168, 85, 247, 0.72)");
    edge.addColorStop(0.5, "rgba(56, 189, 248, 0.62)");
    edge.addColorStop(1, "rgba(168, 85, 247, 0.34)");
    context.strokeStyle = edge;
    context.lineWidth = 3;
    drawRoundedRect(context, 70, 58, 1060, 684, 36);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1;
    drawRoundedRect(context, 96, 86, 1008, 628, 28);
    context.stroke();

    const drawCircuitTrace = (points, color = "rgba(56, 189, 248, 0.34)") => {
      context.save();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.shadowColor = color;
      context.shadowBlur = 8;
      context.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      context.shadowBlur = 12;
      [points[0], points[points.length - 1]].forEach(([x, y]) => {
        context.fillStyle = "#0b1327";
        context.beginPath();
        context.arc(x, y, 6, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = color;
        context.stroke();
      });
      context.restore();
    };

    context.save();
    drawRoundedRect(context, 72, 60, 1056, 680, 34);
    context.clip();
    context.strokeStyle = "rgba(255, 255, 255, 0.022)";
    context.lineWidth = 1;
    for (let row = 118; row <= 686; row += 34) {
      context.beginPath();
      context.moveTo(128, row);
      context.lineTo(1040, row);
      context.stroke();
    }
    context.strokeStyle = "rgba(56, 189, 248, 0.028)";
    for (let col = 148; col <= 1032; col += 36) {
      context.beginPath();
      context.moveTo(col, 102);
      context.lineTo(col, 706);
      context.stroke();
    }
    context.fillStyle = "rgba(56, 189, 248, 0.035)";
    context.fillRect(770, 110, 270, 500);
    drawCircuitTrace([[82, 232], [176, 232], [218, 274], [350, 274]], "rgba(168, 85, 247, 0.34)");
    drawCircuitTrace([[76, 596], [196, 596], [238, 554], [344, 554]], "rgba(56, 189, 248, 0.32)");
    drawCircuitTrace([[1120, 196], [1042, 196], [998, 240], [894, 240]], "rgba(56, 189, 248, 0.38)");
    drawCircuitTrace([[1130, 580], [1048, 580], [1000, 532], [900, 532]], "rgba(168, 85, 247, 0.32)");
    context.restore();

    try {
      const opnLogo = new Image();
      opnLogo.src = OPN_BALANCE_LOGO;
      await opnLogo.decode();
      context.save();
      context.shadowColor = "rgba(56, 189, 248, 0.36)";
      context.shadowBlur = 24;
      drawRoundedRect(context, 930, 112, 128, 128, 26);
      context.fillStyle = "rgba(8, 18, 34, 0.82)";
      context.fill();
      context.strokeStyle = "rgba(143, 215, 232, 0.38)";
      context.lineWidth = 2;
      context.stroke();
      context.shadowBlur = 0;
      context.drawImage(opnLogo, 946, 128, 96, 96);
      context.restore();
    } catch {
      // Receipt export remains available if the decorative logo cannot be decoded.
    }

    const rows = [
      ["Recipient", shortAddress(proofReceipt.recipient)],
      ["Amount", `${proofReceipt.amount} OPN`],
      ["Lockup", proofReceipt.lockupStyle],
      ["Release", formatReceiptDate(proofReceipt.releaseDate)],
      ["Contract", shortAddress(VESTFLOW_ADDRESS)]
    ];

    context.fillStyle = "rgba(56, 189, 248, 0.13)";
    drawRoundedRect(context, 130, 124, 190, 42, 21);
    context.fill();
    context.strokeStyle = "rgba(143, 215, 232, 0.5)";
    context.stroke();
    writeText("PROOF RECEIPT", 148, 153, 20, "#8fd7e8", 950, 170);
    writeText(`Vault #${proofReceipt.vaultId}`, 130, 238, 66, "#fff7e8", 950, 600);
    writeText("created on OPN Testnet", 132, 286, 26, "#8fd7e8", 800, 420);

    context.save();
    context.shadowColor = "rgba(168, 85, 247, 0.24)";
    context.shadowBlur = 28;
    drawRoundedRect(context, 120, 326, 700, 296, 24);
    context.fillStyle = "rgba(255, 255, 255, 0.06)";
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1;
    context.stroke();
    context.restore();

    rows.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 148 + column * 332;
      const y = 356 + row * 86;
      const width = 300;
      drawRoundedRect(context, x, y, width, 62, 14);
      context.fillStyle = "rgba(8, 13, 28, 0.42)";
      context.fill();
      context.strokeStyle = "rgba(143, 215, 232, 0.16)";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "rgba(56, 189, 248, 0.72)";
      context.beginPath();
      context.arc(x + 18, y + 31, 5, 0, Math.PI * 2);
      context.fill();
      writeText(label.toUpperCase(), x + 34, y + 25, 14, "rgba(248, 245, 255, 0.58)", 900, width - 46);
      writeText(value, x + 34, y + 52, 22, "#fff7e8", 900, width - 46);
    });

    context.save();
    context.translate(946, 378);
    const chipGlow = context.createRadialGradient(-24, -20, 8, 0, 0, 150);
    chipGlow.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    chipGlow.addColorStop(0.45, "rgba(56, 189, 248, 0.22)");
    chipGlow.addColorStop(1, "rgba(124, 58, 237, 0.08)");
    context.shadowColor = "rgba(56, 189, 248, 0.36)";
    context.shadowBlur = 32;
    context.fillStyle = chipGlow;
    drawRoundedRect(context, -110, -110, 220, 220, 32);
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(143, 215, 232, 0.52)";
    context.lineWidth = 3;
    drawRoundedRect(context, -110, -110, 220, 220, 32);
    context.stroke();
    context.setLineDash([7, 7]);
    context.strokeStyle = "rgba(168, 85, 247, 0.34)";
    context.lineWidth = 2;
    drawRoundedRect(context, -92, -92, 184, 184, 24);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = "rgba(248, 245, 255, 0.14)";
    context.lineWidth = 1;
    for (let pin = -78; pin <= 78; pin += 26) {
      context.beginPath();
      context.moveTo(pin, -110);
      context.lineTo(pin, -126);
      context.moveTo(pin, 110);
      context.lineTo(pin, 126);
      context.moveTo(-110, pin);
      context.lineTo(-126, pin);
      context.moveTo(110, pin);
      context.lineTo(126, pin);
      context.stroke();
    }
    context.fillStyle = "rgba(8, 14, 28, 0.78)";
    drawRoundedRect(context, -58, -48, 116, 96, 18);
    context.fill();
    context.strokeStyle = "rgba(56, 189, 248, 0.46)";
    context.lineWidth = 2;
    drawRoundedRect(context, -58, -48, 116, 96, 18);
    context.stroke();
    context.strokeStyle = "rgba(143, 215, 232, 0.2)";
    context.lineWidth = 1;
    for (let y = -28; y <= 28; y += 14) {
      context.beginPath();
      context.moveTo(-44, y);
      context.lineTo(44, y);
      context.stroke();
    }
    for (let x = -34; x <= 34; x += 17) {
      context.beginPath();
      context.moveTo(x, -36);
      context.lineTo(x, 36);
      context.stroke();
    }
    context.strokeStyle = "rgba(255, 255, 255, 0.8)";
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(-22, -4);
    context.lineTo(22, -4);
    context.moveTo(-22, 10);
    context.lineTo(16, 10);
    context.stroke();
    context.restore();

    context.fillStyle = "rgba(234, 216, 166, 0.92)";
    context.font = "800 24px Arial";
    context.fillText("VestFlow Protocol  OPN Testnet", 130, 675);

    context.fillStyle = "rgba(143, 215, 232, 0.78)";
    context.font = "800 18px Arial";
    if (proofReceipt.txHash) {
      context.fillText(`TX ${shortAddress(proofReceipt.txHash)}`, 820, 675);
    }

    const link = document.createElement("a");
    link.download = `vestflow-vault-${proofReceipt.vaultId}-proof.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    notify("Receipt downloaded.", "", "success");
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

  function handleMobileNavigation(pageId) {
    handleSidebarNavigation(pageId);
    setMobileMoreOpen(false);
  }

  function handleSidebarNavigation(pageId) {
    setActivePage(pageId);
    if (window.matchMedia("(max-width: 1120px)").matches) {
      setSidebarCollapsed(true);
    }
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
      let candidateIds = [];
      let scanAllVaults = false;

      try {
        const [createdVaultIds, recipientVaultIds] = await Promise.all([
          contract.getCreatedVaults(account),
          contract.getRecipientVaults(account)
        ]);
        candidateIds = Array.from(
          new Set([
            ...createdVaultIds.map((id) => String(id)),
            ...recipientVaultIds.map((id) => String(id))
          ])
        );
      } catch {
        scanAllVaults = true;
        candidateIds = Array.from({ length: totalVaults }, (_, index) => String(index));
      }

      candidateIds.sort((left, right) => Number(left) - Number(right));
      const batchSize = 12;
      const vaults = [];
      const nextHiddenClaimedVaultIds = new Set(readHiddenClaimedVaults(account));

      for (let start = 0; start < candidateIds.length; start += batchSize) {
        const batchIds = candidateIds.slice(start, start + batchSize);
        const batchVaults = await Promise.all(
          batchIds.map(async (id) => {
            try {
              const data = await contract.vaults(id);
              return { id, data };
            } catch {
              return null;
            }
          })
        );

        const relevantVaults = scanAllVaults
          ? batchVaults.filter(Boolean).filter(({ data }) => {
            const recipient = data.recipient?.toLowerCase();
            const creator = data.creator?.toLowerCase();
            return recipient === accountLower || creator === accountLower;
          })
          : batchVaults.filter(Boolean);

        const detailedVaults = await Promise.all(
          relevantVaults.map(async ({ id, data }) => {
            try {
              const [claimable, vested] = await Promise.all([
                contract.claimableAmount(id),
                contract.vestedAmount(id)
              ]);
              const info = mapVaultInfo(data, claimable, vested);
              return { id, ...info };
            } catch {
              return null;
            }
          })
        );

        detailedVaults.filter(Boolean).forEach((vault) => {
          vaults.push(vault);
          if (isVaultFullyClaimed(vault)) {
            nextHiddenClaimedVaultIds.add(vault.id);
          }
        });
      }

      setMyVaults(vaults);
      setHiddenClaimedVaultIds(nextHiddenClaimedVaultIds);
      persistHiddenClaimedVaults(account, nextHiddenClaimedVaultIds);
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
    if (hasKnownWalletBalance && (parsedWalletBalance < 0.01 || parsedAmount > parsedWalletBalance)) {
      throw new Error("Not enough OPN balance. Use the faucet to get testnet OPN.");
    }
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
      window.requestAnimationFrame(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        proofSuccessRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
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

  function createAnotherLock() {
    setProofReceipt(null);
    setAssetTab("native");
    setUseCustomRecipient(false);
    setDurationPreset("custom");
    setNoteOption("Contributor Reward");
    setForm({
      recipient: "",
      amount: "0.01",
      lockupStyle: "linear",
      releaseDate: getDefaultReleaseDate(),
      note: "Contributor Reward"
    });
    setFormChangedAfterReceipt(false);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector(".lock-page")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  function trackLatestVault() {
    if (!proofReceipt?.vaultId) return;
    setVaultId(proofReceipt.vaultId);
    setActivePage("track");
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
      addActivity("Claim Executed", `Vault ${selectedVaultId} claimed successfully.`, tx.hash);
      await refreshWalletBalance(account);
      const refreshedVault = await loadSelectedVaultData(selectedVaultId);
      await loadMyVaults(false);
      await loadLiveContractData(false);
      if (isVaultFullyClaimed(refreshedVault)) {
        const nextHiddenVaultIds = new Set(readHiddenClaimedVaults(account));
        nextHiddenVaultIds.add(String(selectedVaultId));
        setHiddenClaimedVaultIds(nextHiddenVaultIds);
        persistHiddenClaimedVaults(account, nextHiddenVaultIds);
        notify("Vault claimed and archived from active list.", `Vault ID ${selectedVaultId}.`, "success");
      } else {
        notify("Claim successful.", `Tx: ${shortAddress(tx.hash)}`, "success");
      }
    } catch (error) {
      reportError(new Error(normalizeWalletError(error)));
    } finally {
      setPendingAction("");
    }
  }

  const guideSteps = [
    {
      badge: "STEP 01",
      title: "Connect your wallet",
      description: "Connect your OKX, MetaMask, or supported EVM wallet on OPN Testnet. Your wallet is the main on-chain identity for creating and claiming vaults.",
      Icon: Wallet
    },
    {
      badge: "STEP 02",
      title: "Get testnet OPN",
      description: "If your balance is low, use the OPN Testnet faucet. You need testnet OPN to create vaults and pay gas fees.",
      Icon: Droplets
    },
    {
      badge: "STEP 03",
      title: "Create a secure lock",
      description: "Open Lock Assets, choose the amount, recipient, lockup style, release date, and purpose note. Then create your vault on-chain.",
      Icon: LockKeyhole
    },
    {
      badge: "STEP 04",
      title: "Save your Vault ID",
      description: "Every created vault has a Vault ID. Use it to track status, verify claimable amount, and share proof with contributors or communities.",
      Icon: Hash
    },
    {
      badge: "STEP 05",
      title: "Track vesting status",
      description: "Go to Track & Claim, select a vault, and review claimable OPN, vesting status, countdown, and contract data.",
      Icon: SearchCheck
    },
    {
      badge: "STEP 06",
      title: "Claim when ready",
      description: "When the vault becomes claimable, click Claim Vault. VestFlow reads on-chain data and updates the vault status after the transaction confirms.",
      Icon: BadgeCheck
    },
    {
      badge: "STEP 07",
      title: "Share proof receipt",
      description: "After creating a vault, use Share to X or Download Receipt to share a clean proof card with vault details.",
      Icon: Share2
    },
    {
      badge: "STEP 08",
      title: "Use it for builder flows",
      description: "VestFlow can support contributor rewards, grant distribution, DAO allocations, ecosystem campaigns, and launch unlock schedules.",
      Icon: Network
    }
  ];

  return (
    <>
      <header className="mobile-header">
        <button
          className="mobile-brand"
          type="button"
          onClick={() => handleMobileNavigation("home")}
          aria-label="Go to home"
        >
          <span className="brand-logo">
            <img src="/iopn-logo.png" alt="VestFlow logo" />
          </span>
          <span className="brand-copy">
            <strong className="brand-title">VestFlow Protocol</strong>
            <small className="brand-subtitle">IOPn / OPN Testnet</small>
          </span>
        </button>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Mobile page navigation" ref={mobileMoreMenuRef}>
        {navItems.slice(0, 4).map(({ label, id, Icon }) => (
          <button
            key={id}
            type="button"
            className={activePage === id ? "active" : ""}
            onClick={() => handleMobileNavigation(id)}
            aria-current={activePage === id ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={19} strokeWidth={2.25} />
            <span>{id === "track" ? "Track" : label}</span>
          </button>
        ))}
        <button
          type="button"
          className={["roadmap", "about"].includes(activePage) || mobileMoreOpen ? "active" : ""}
          onClick={() => setMobileMoreOpen((open) => !open)}
          aria-expanded={mobileMoreOpen}
          aria-controls="mobile-more-menu"
        >
          <Menu aria-hidden="true" size={19} strokeWidth={2.25} />
          <span>More</span>
        </button>
        {mobileMoreOpen && (
          <div id="mobile-more-menu" className="mobile-more-menu" role="menu">
            {navItems.slice(4).map(({ label, id, Icon }) => (
              <button
                key={id}
                type="button"
                className={activePage === id ? "active" : ""}
                onClick={() => handleMobileNavigation(id)}
                role="menuitem"
              >
                <Icon aria-hidden="true" size={17} strokeWidth={2.35} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <aside className={sidebarCollapsed ? "sidebar is-collapsed" : "sidebar"}>
        <div className="sidebar-top">
        <button
          className={sidebarCollapsed ? "nav-brand brand-row is-collapsed" : "nav-brand brand-row"}
          onClick={() => {
            if (sidebarCollapsed) {
              setSidebarCollapsed(false);
            } else {
              handleSidebarNavigation("home");
            }
          }}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "VestFlow home"}
          title={sidebarCollapsed ? "Expand sidebar" : "VestFlow home"}
        >
          <span className="brand-logo">
            <img src="/iopn-logo.png" alt="VestFlow logo" />
          </span>
          <span className="brand-copy">
            <strong className="brand-title">VestFlow Protocol</strong>
            <small className="brand-subtitle">IOPn / OPN Testnet</small>
          </span>
        </button>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setSidebarCollapsed((isCollapsed) => !isCollapsed)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight aria-hidden="true" size={18} /> : <ChevronLeft aria-hidden="true" size={18} />}
        </button>
        </div>
        <div className="menu-label">MAIN</div>
        <nav className="nav-links" aria-label="Page sections">
          {navItems.map(({ label, id, Icon }) => (
            <button
              key={id}
              className={activePage === id ? "nav-item active" : "nav-item"}
              onClick={() => handleSidebarNavigation(id)}
              aria-label={label}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={2.35} />
              <span className="nav-label">{label}</span>
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
                <strong>Wallet connected</strong>
              </div>
              <div className="dropdown-balance">
                <img src={OPN_BALANCE_LOGO} alt="" />
                <div>
                  <span>OPN Balance</span>
                  <strong>{isBalanceLoading ? "..." : `${formatWalletBalance(walletBalance)} OPN`}</strong>
                </div>
              </div>
              {hasLowWalletBalance && (
                <div className="wallet-faucet-row">
                  <div>
                    <strong>Need testnet OPN?</strong>
                    <span>You need OPN Testnet coins to create vaults and pay gas fees.</span>
                  </div>
                  <div className="faucet-actions">
                    <a href={OPN_FAUCET_URL} target="_blank" rel="noreferrer">Open OPN Faucet</a>
                    <button type="button" onClick={() => copyText(account, "Wallet address copied.")}>Copy Wallet Address</button>
                  </div>
                </div>
              )}
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

      <main className={sidebarCollapsed ? "page sidebar-collapsed" : "page"}>
        <div key={activePage} className="page-transition">
        {activePage === "home" && (
          <>
        <section className="hero home-hero page-panel reveal reveal-up" data-reveal>
          <video className="home-hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
            <source src="/home_bg.mp4" type="video/mp4" />
          </video>
          <div className="home-hero-overlay" aria-hidden="true" />
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
        {!proofReceipt ? (
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
                    {hasLowWalletBalance && (
                      <div className="lock-faucet-cta">
                        <div>
                          <strong>Need testnet OPN?</strong>
                          <span>You need OPN Testnet coins to create vaults and pay gas fees.</span>
                        </div>
                        <div className="faucet-actions">
                          <a href={OPN_FAUCET_URL} target="_blank" rel="noreferrer">Open OPN Faucet</a>
                          <button type="button" onClick={() => copyText(account, "Wallet address copied.")}>Copy Wallet Address</button>
                        </div>
                      </div>
                    )}
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
                        <div className={`amount-slider-wrap ${isAmountSliding ? "is-sliding" : ""}`}>
                          <input
                            className={`amount-slider ${isAmountSliding ? "is-sliding" : ""}`}
                            type="range"
                            min="0"
                            max="100"
                            value={amountSliderValue}
                            onChange={(e) => updateAmountFromBalance(Number(e.target.value))}
                            onPointerDown={() => setIsAmountSliding(true)}
                            onPointerUp={() => setIsAmountSliding(false)}
                            onPointerCancel={() => setIsAmountSliding(false)}
                            onMouseDown={() => setIsAmountSliding(true)}
                            onMouseUp={() => setIsAmountSliding(false)}
                            onTouchStart={() => setIsAmountSliding(true)}
                            onTouchEnd={() => setIsAmountSliding(false)}
                            onBlur={() => setIsAmountSliding(false)}
                            style={{ "--amount-progress": `${amountSliderValue}%` }}
                            aria-label="Amount percentage of wallet balance"
                          />
                        </div>
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

                  <button
                    className={`primary-action action-button create-lock-button ${pendingAction === "create" ? "is-loading" : ""}`}
                    onClick={createVault}
                    disabled={assetTab !== "native" || Boolean(pendingAction)}
                    aria-busy={pendingAction === "create"}
                    aria-label={pendingAction === "create" ? "Creating secure lock" : "Create Secure Lock"}
                  >
                    <span className="button-label">Create Secure Lock</span>
                    <span className="button-spinner" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
        </section>
        ) : (
        <section ref={proofSuccessRef} className="lock-page lock-success-screen proof-success-screen page-panel" data-reveal>
          <div className="lock-success-heading proof-success-heading">
            <p className="section-kicker">Success</p>
            <h2><span>Vault created</span> <span className="gradient-title">successfully</span></h2>
            <p>Your VestFlow lock is now live on OPN Testnet.</p>
          </div>

          <div className="share-proof-section">
            <div className="share-proof-3d-wrap proof-card-activated">
              <div className="share-proof-card">
                <div className="share-proof-glow" aria-hidden="true" />
                <div className="share-proof-circuit" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="share-proof-content">
                  <div className="share-proof-header">
                    <div className="share-proof-heading">
                      <span className="share-proof-badge">
                        <ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                        PROOF RECEIPT
                      </span>
                      <h2 className="share-proof-title">Vault #{proofReceipt.vaultId}</h2>
                      <p className="share-proof-subtitle">created on OPN Testnet</p>
                    </div>
                    <div className="proof-card-brand">
                      <img src={OPN_BALANCE_LOGO} alt="OPN logo" className="proof-card-brand-logo" />
                    </div>
                  </div>
                  <div className="share-proof-body">
                    <div className="share-proof-details">
                      <div className="share-proof-row"><span className="share-proof-row-icon" aria-hidden="true" /><span>Recipient</span><strong>{shortAddress(proofReceipt.recipient)}</strong></div>
                      <div className="share-proof-row"><span className="share-proof-row-icon" aria-hidden="true" /><span>Amount</span><strong>{proofReceipt.amount} OPN</strong></div>
                      <div className="share-proof-row"><span className="share-proof-row-icon" aria-hidden="true" /><span>Lockup</span><strong>{proofReceipt.lockupStyle}</strong></div>
                      <div className="share-proof-row"><span className="share-proof-row-icon" aria-hidden="true" /><span>Release</span><strong>{formatReceiptDate(proofReceipt.releaseDate)}</strong></div>
                      <div className="share-proof-row"><span className="share-proof-row-icon" aria-hidden="true" /><span>Contract</span><strong>{shortAddress(VESTFLOW_ADDRESS)}</strong></div>
                    </div>
                    <div className="share-proof-lock-visual" aria-hidden="true">
                      <span className="share-proof-orb">
                        <LockKeyhole size={76} strokeWidth={1.6} />
                      </span>
                    </div>
                  </div>
                  <div className="share-proof-footer">VestFlow Protocol <span>OPN Testnet</span></div>
                </div>
              </div>
            </div>
            <div className="share-proof-actions">
              <span className="share-proof-actions-label">Proof actions</span>
              <div className="share-proof-action-row primary">
                <button type="button" className="share-x-action" onClick={shareProofToX}>Share to X</button>
                <button type="button" className="download-receipt-action" onClick={downloadReceiptPng}>Download Receipt</button>
              </div>
              <div className="share-proof-action-row secondary">
                <button type="button" className="track-vault-action" onClick={trackLatestVault}>Track this Vault</button>
                <button type="button" className="create-another-action" onClick={createAnotherLock}>Create Another Lock</button>
              </div>
            </div>
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
                  <span>{account ? myVaultsShownLabel : "Wallet required"}</span>
                  <button type="button" onClick={() => loadMyVaults(true)} disabled={!account || isVaultListLoading}>
                    {isVaultListLoading ? "Refreshing..." : "Refresh My Vaults"}
                  </button>
                  <button
                    type="button"
                    className={`toggle-claimed-vaults ${showClaimedVaults ? "active" : ""}`}
                    onClick={() => setShowClaimedVaults((enabled) => !enabled)}
                    disabled={!account}
                    aria-pressed={showClaimedVaults}
                  >
                    {showClaimedVaults ? "Hide claimed vaults" : "Show claimed vaults"}
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
                  ) : visibleMyVaults.length ? (
                    visibleMyVaults.map((vault) => {
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
                  <p>Claimable amount and status for the selected vault.</p>
                </div>
                {isVaultLoading ? (
                  <div className="empty-state">Loading vault data...</div>
                ) : vaultInfo ? (
                  <TrackVaultDetails vault={vaultInfo} now={countdownNow} />
                ) : (
                  <div className="empty-state">Select a vault or enter a Vault ID.</div>
                )}
              </div>
            </div>
            <div className="claim-center-actions">
              <button
                className={`action-button claim-vault-button ${!vaultId.trim() ? "soft-disabled" : ""} ${pendingAction === "claim" ? "is-loading" : ""}`}
                onClick={claimVault}
                disabled={Boolean(pendingAction)}
                aria-busy={pendingAction === "claim"}
                aria-label={pendingAction === "claim" ? "Claiming vault" : "Claim Vault"}
              >
                <span className="button-label">Claim Vault</span>
                <span className="button-spinner" aria-hidden="true" />
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
          <section className="guide-journey page-panel reveal reveal-up" data-reveal>
            <div className="guide-hero">
              <span className="section-kicker">VESTFLOW GUIDE</span>
              <h2 className="guide-title"><span>How VestFlow</span> <span className="gradient-title">Works</span></h2>
              <p>
                A guided on-chain flow for locking native OPN, tracking vault status, and sharing proof receipts.
              </p>
            </div>

            <div className="guide-card-grid">
              {guideSteps.map((step, index) => {
                const sideClass = index % 2 === 0 ? "left" : "right";
                return (
                  <article
                    key={step.badge}
                    className={`guide-flow-card ${sideClass} reveal reveal-up`}
                    data-reveal
                    style={{ "--delay": `${index * 70}ms` }}
                  >
                    <span className="guide-step-badge">{step.badge}</span>
                    <div className="guide-flow-header">
                      <span className="guide-icon" aria-hidden="true">
                        <step.Icon size={18} strokeWidth={2.3} />
                      </span>
                      <div className="guide-flow-copy">
                        <h3>{step.title}</h3>
                        <span className="guide-flow-arrow" aria-hidden="true">
                          <ChevronRight size={14} strokeWidth={2.4} />
                        </span>
                      </div>
                    </div>
                    <p>{step.description}</p>
                  </article>
                );
              })}
            </div>

            <section className="guide-resources">
              <div className="guide-resources-heading">
                <span className="section-kicker">Useful Links</span>
                <p>Quick links for demo testing and verification.</p>
              </div>
              <div className="guide-resources-grid">
                <a href={DAPP_URL} target="_blank" rel="noreferrer">
                  <strong>VestFlow Demo</strong>
                  <span>vestflow-protocol.vercel.app</span>
                </a>
                <a href={EXPLORER_URL} target="_blank" rel="noreferrer">
                  <strong>OPN Explorer</strong>
                  <span>testnet.iopn.tech</span>
                </a>
                <a href={OPN_FAUCET_URL} target="_blank" rel="noreferrer">
                  <strong>OPN Faucet</strong>
                  <span>faucet.iopn.tech</span>
                </a>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <strong>GitHub Repository</strong>
                  <span>github.com/ekypanawa/vestflow-protocol</span>
                </a>
              </div>
            </section>
          </section>
        )}

        {activePage === "roadmap" && (
          <>
        <section className="roadmap page-panel reveal reveal-up" data-reveal>
          <p className="section-kicker">Roadmap</p>
          <h2>Roadmap</h2>
          <h3 className="roadmap-subtitle gradient-title">Q1-Q4 2026</h3>
          <p className="roadmap-description">
            VestFlow roadmap for testnet deployment, builder feedback, advanced distribution flows, and long-term OPN ecosystem readiness.
          </p>

          <div className="roadmap-timeline" ref={roadmapTimelineRef}>
            <article className="roadmap-item left reveal reveal-up" data-reveal style={{ "--delay": "0ms" }}>
              <span className="roadmap-node" aria-hidden="true" />
              <div className="roadmap-card">
                <span className="roadmap-step-badge">Step 01</span>
                <span className="roadmap-quarter">Q1 2026</span>
                <h3 className="roadmap-title">MVP and OPN Testnet deployment</h3>
                <ul className="roadmap-list">
                  <li>Deploy VestFlow smart contract on OPN Testnet</li>
                  <li>Support native OPN lock and vesting vaults</li>
                  <li>Add vault creation, claim flow, and proof receipt</li>
                  <li>Add multi-wallet connection and on-chain explorer links</li>
                  <li>Build the first public dashboard for tracking vault status</li>
                </ul>
              </div>
            </article>

            <article className="roadmap-item right reveal reveal-up" data-reveal style={{ "--delay": "80ms" }}>
              <span className="roadmap-node" aria-hidden="true" />
              <div className="roadmap-card">
                <span className="roadmap-step-badge">Step 02</span>
                <span className="roadmap-quarter">Q2 2026</span>
                <h3 className="roadmap-title">Builder feedback and product refinement</h3>
                <ul className="roadmap-list">
                  <li>Improve UX based on builder and community feedback</li>
                  <li>Add better vault indexing and wallet-based vault discovery</li>
                  <li>Improve vault analytics, claim status, and activity history</li>
                  <li>Add public usage examples for contributors, grants, and community rewards</li>
                  <li>Polish mobile experience and dashboard performance</li>
                </ul>
              </div>
            </article>

            <article className="roadmap-item left reveal reveal-up" data-reveal style={{ "--delay": "160ms" }}>
              <span className="roadmap-node" aria-hidden="true" />
              <div className="roadmap-card">
                <span className="roadmap-step-badge">Step 03</span>
                <span className="roadmap-quarter">Q3 2026</span>
                <h3 className="roadmap-title">Advanced distribution flows</h3>
                <ul className="roadmap-list">
                  <li>Add DAO grant and contributor reward templates</li>
                  <li>Explore multi-recipient vault creation</li>
                  <li>Add richer dashboard data for teams and recipients</li>
                  <li>Improve proof sharing for communities and grant programs</li>
                  <li>Research reusable vault templates for ecosystem campaigns</li>
                </ul>
              </div>
            </article>

            <article className="roadmap-item right reveal reveal-up" data-reveal style={{ "--delay": "240ms" }}>
              <span className="roadmap-node" aria-hidden="true" />
              <div className="roadmap-card">
                <span className="roadmap-step-badge">Step 04</span>
                <span className="roadmap-quarter">Q4 2026</span>
                <h3 className="roadmap-title">Security, scalability, and expansion research</h3>
                <ul className="roadmap-list">
                  <li>Prepare for security review and audit readiness</li>
                  <li>Improve contract safety, validation, and edge-case handling</li>
                  <li>Research ERC-20 support for future token vesting</li>
                  <li>Explore mainnet readiness if OPN ecosystem conditions are ready</li>
                  <li>Document integration paths for OPN builders and ecosystem partners</li>
                </ul>
              </div>
            </article>

            <article className="roadmap-item vision reveal reveal-up" data-reveal style={{ "--delay": "320ms" }}>
              <span className="roadmap-node" aria-hidden="true" />
              <div className="roadmap-card roadmap-vision-card">
                <span className="roadmap-step-badge">Step 05</span>
                <span className="roadmap-quarter">Long-term Vision</span>
                <h3 className="roadmap-title"><span>Reusable fund distribution</span> <span className="gradient-title">for OPN builders</span></h3>
                <p>VestFlow aims to become a reusable fund distribution layer for the OPN ecosystem.</p>
                <p>The goal is to help builders, DAOs, grant programs, contributors, and communities manage vesting, rewards, treasury payouts, and launch unlocks transparently on-chain.</p>
                <p>Instead of relying on manual payments, private spreadsheets, or trust-based promises, VestFlow turns fund distribution into a verifiable smart contract workflow on OPN Chain.</p>
              </div>
            </article>
          </div>
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
