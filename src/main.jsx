import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./style.css";

const OPN_CHAIN_ID_HEX = "0x3d8";
const OPN_TESTNET = {
  chainId: OPN_CHAIN_ID_HEX,
  chainName: "OPN Testnet",
  nativeCurrency: { name: "OPN", symbol: "OPN", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.iopn.tech"],
  blockExplorerUrls: ["https://testnet.iopn.tech"]
};

const VESTFLOW_ADDRESS = import.meta.env.VITE_VESTFLOW_ADDRESS || "";

const ABI = [
  "function createVault(address recipient,uint64 cliffSeconds,uint64 durationSeconds,string title) payable returns (uint256)",
  "function claim(uint256 vaultId)",
  "function claimableAmount(uint256 vaultId) view returns (uint256)",
  "function vestedAmount(uint256 vaultId) view returns (uint256)",
  "function getCreatedVaults(address creator) view returns (uint256[])",
  "function getRecipientVaults(address recipient) view returns (uint256[])",
  "function vaults(uint256) view returns (address creator,address recipient,uint256 amount,uint256 claimed,uint64 start,uint64 cliff,uint64 duration,bool cancelled,string title)",
  "event VaultCreated(uint256 indexed vaultId,address indexed creator,address indexed recipient,uint256 amount,uint64 start,uint64 cliff,uint64 duration,string title)",
  "event Claimed(uint256 indexed vaultId,address indexed recipient,uint256 amount)"
];

function App() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("Ready to build on OPN Chain.");
  const [form, setForm] = useState({
    recipient: "",
    amount: "0.01",
    cliffDays: "0",
    durationDays: "30",
    title: "Contributor Vesting Vault"
  });
  const [vaultId, setVaultId] = useState("0");
  const [vaultInfo, setVaultInfo] = useState(null);

  const contractReady = useMemo(() => Boolean(VESTFLOW_ADDRESS), []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      setAccount(accounts?.[0] || "");
      setStatus(accounts?.[0] ? "Wallet account changed." : "Wallet disconnected.");
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  async function getProvider() {
    if (!window.ethereum) throw new Error("Wallet not found. Install MetaMask or OKX Wallet.");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: OPN_CHAIN_ID_HEX }] });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [OPN_TESTNET] });
      } else {
        throw switchError;
      }
    }
    return new BrowserProvider(window.ethereum);
  }

  async function connectWallet() {
    try {
      const provider = await getProvider();
      const signer = await provider.getSigner();
      setAccount(await signer.getAddress());
      setStatus("Wallet connected to OPN Testnet.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function changeWallet() {
    try {
      if (!window.ethereum) {
        throw new Error("Wallet not found. Install MetaMask or OKX Wallet.");
      }

      try {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }]
        });
      } catch (permissionError) {
        console.log("Wallet permission request skipped:", permissionError);
      }

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const selectedAddress = await signer.getAddress();

      setAccount(selectedAddress);
      setStatus(`Wallet changed: ${selectedAddress}`);
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function getContract() {
    if (!contractReady) throw new Error("Contract address missing. Set VITE_VESTFLOW_ADDRESS in .env after deployment.");
    const provider = await getProvider();
    const signer = await provider.getSigner();
    return new Contract(VESTFLOW_ADDRESS, ABI, signer);
  }

  async function createVault() {
    try {
      setStatus("Creating vault transaction...");
      const contract = await getContract();
      const cliffSeconds = BigInt(Number(form.cliffDays || 0) * 24 * 60 * 60);
      const durationSeconds = BigInt(Number(form.durationDays || 0) * 24 * 60 * 60);
      const tx = await contract.createVault(form.recipient, cliffSeconds, durationSeconds, form.title, {
        value: parseEther(form.amount || "0")
      });
      setStatus(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      setStatus(`Vault created successfully. Tx: ${tx.hash}`);
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function loadVault() {
    try {
      setStatus("Loading vault...");
      const contract = await getContract();
      const data = await contract.vaults(vaultId);
      const claimable = await contract.claimableAmount(vaultId);
      setVaultInfo({
        creator: data.creator,
        recipient: data.recipient,
        amount: formatEther(data.amount),
        claimed: formatEther(data.claimed),
        start: Number(data.start),
        cliff: Number(data.cliff),
        duration: Number(data.duration),
        cancelled: data.cancelled,
        title: data.title,
        claimable: formatEther(claimable)
      });
      setStatus("Vault loaded.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function claimVault() {
    try {
      setStatus("Claiming vested funds...");
      const contract = await getContract();
      const tx = await contract.claim(vaultId);
      setStatus(`Claim transaction sent: ${tx.hash}`);
      await tx.wait();
      setStatus(`Claim complete. Tx: ${tx.hash}`);
      await loadVault();
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="badge">OPN Builders · DeFi & Open Finance</div>
        <h1>VestFlow Protocol</h1>
        <p>
          A trustless vesting and fund distribution protocol for teams, contributors,
          and communities on OPN Chain.
        </p>
        <div className="actions">
          <button onClick={connectWallet}>{account ? "Wallet Connected" : "Connect Wallet"}</button>
          {account && <button onClick={changeWallet}>Change Wallet</button>}
          <a href="https://testnet.iopn.tech" target="_blank" rel="noreferrer">Open Explorer</a>
        </div>
        {account && <p className="wallet">{account}</p>}
      </section>

      {!contractReady && (
        <section className="warning">
          Contract address is not set yet. Deploy the contract, then add it to <code>VITE_VESTFLOW_ADDRESS</code>.
        </section>
      )}

      <section className="grid">
        <div className="card">
          <h2>Create Vesting Vault</h2>
          <label>Recipient Wallet</label>
          <input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="0x..." />

          <label>Amount in OPN</label>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />

          <div className="two">
            <div>
              <label>Cliff Days</label>
              <input value={form.cliffDays} onChange={(e) => setForm({ ...form, cliffDays: e.target.value })} />
            </div>
            <div>
              <label>Duration Days</label>
              <input value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
            </div>
          </div>

          <label>Vault Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <button onClick={createVault}>Create Vault</button>
        </div>

        <div className="card">
          <h2>Track & Claim</h2>
          <label>Vault ID</label>
          <input value={vaultId} onChange={(e) => setVaultId(e.target.value)} />
          <div className="actions compact">
            <button onClick={loadVault}>Load Vault</button>
            <button onClick={claimVault}>Claim</button>
          </div>
          {vaultInfo && (
            <div className="vault">
              <p><b>Title:</b> {vaultInfo.title}</p>
              <p><b>Recipient:</b> {vaultInfo.recipient}</p>
              <p><b>Total:</b> {vaultInfo.amount} OPN</p>
              <p><b>Claimed:</b> {vaultInfo.claimed} OPN</p>
              <p><b>Claimable:</b> {vaultInfo.claimable} OPN</p>
              <p><b>Status:</b> {vaultInfo.cancelled ? "Cancelled" : "Active"}</p>
            </div>
          )}
        </div>
      </section>

      <section className="status">
        <b>Status:</b> {status}
      </section>

      <section className="features">
        <h2>Why VestFlow matters</h2>
        <div className="feature-grid">
          <div><h3>Trustless</h3><p>Funds are locked and released by smart contract rules.</p></div>
          <div><h3>Transparent</h3><p>Vaults, deposits, and claims are verifiable on-chain.</p></div>
          <div><h3>Useful</h3><p>Designed for teams, DAOs, contributors, and community grants.</p></div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
