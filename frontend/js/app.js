// TriX Frontend Application Logic

let currentAccount = null;
let isConnected = false;

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletStatus = document.getElementById('walletStatus');
const networkStatus = document.getElementById('networkStatus');
const walletAddress = document.getElementById('walletAddress');
const ethBalance = document.getElementById('ethBalance');
const gtBalance = document.getElementById('gtBalance');

// Token Purchase Elements
const usdtAmountInput = document.getElementById('usdtAmount');
const gtReceiveInput = document.getElementById('gtReceive');
const approveUSDTBtn = document.getElementById('approveUSDT');
const purchaseGTBtn = document.getElementById('purchaseGT');

// Match Creation Elements
const stakeAmountInput = document.getElementById('stakeAmount');
const approveGTBtn = document.getElementById('approveGT');
const createMatchBtn = document.getElementById('createMatch');

// Other Elements
const matchesList = document.getElementById('matchesList');
const transactionHistory = document.getElementById('transactionHistory');
const statusMessage = document.getElementById('statusMessage');
const statusText = document.getElementById('statusText');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    console.log('TriX Frontend Initialized');

    // Check if wallet is already connected
    checkWalletConnection();

    // Set up event listeners
    setupEventListeners();

    // Update UI periodically
    setInterval(updateUI, CONFIG.POLLING_INTERVAL);
});

// Event Listeners
function setupEventListeners() {
    connectWalletBtn.addEventListener('click', connectWallet);

    // Token Purchase
    usdtAmountInput.addEventListener('input', calculateGTReceive);
    approveUSDTBtn.addEventListener('click', approveUSDTTokens);
    purchaseGTBtn.addEventListener('click', buyGameTokens);

    // Match Creation
    approveGTBtn.addEventListener('click', approveGameTokensForMatch);
    createMatchBtn.addEventListener('click', createNewMatch);
}

// Wallet Connection
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error('Error checking wallet connection:', error);
        }
    } else {
        showStatus('Please install MetaMask to use this application', 'warning');
    }
}

async function connectWallet() {
    try {
        if (typeof window.ethereum !== 'undefined') {
            showLoading(true);

            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            // Check network
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const expectedChainId = NETWORKS[CURRENT_NETWORK].chainId;

            if (chainId !== expectedChainId) {
                await switchNetwork();
            }

            // Initialize ethers
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Initialize contracts
            const success = await initializeContracts(signer);
            if (!success) {
                throw new Error('Failed to initialize contracts');
            }

            currentAccount = accounts[0];
            isConnected = true;

            // Update UI
            updateWalletDisplay();
            await updateBalances();
            await loadMatches();

            showStatus('Wallet connected successfully!', 'success');

        } else {
            showStatus('Please install MetaMask', 'error');
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showStatus('Failed to connect wallet: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function switchNetwork() {
    try {
        const network = NETWORKS[CURRENT_NETWORK];
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: network.chainId }],
        });
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [NETWORKS[CURRENT_NETWORK]],
                });
            } catch (addError) {
                throw new Error('Failed to add network to MetaMask');
            }
        } else {
            throw new Error('Failed to switch network');
        }
    }
}

// UI Updates
function updateWalletDisplay() {
    if (isConnected) {
        walletStatus.classList.remove('hidden');
        connectWalletBtn.textContent = 'Connected';
        connectWalletBtn.classList.add('bg-green-600');
        connectWalletBtn.disabled = true;

        walletAddress.textContent = currentAccount;
        networkStatus.textContent = NETWORKS[CURRENT_NETWORK].chainName;
        networkStatus.classList.remove('bg-gray-700');
        networkStatus.classList.add('bg-green-600');
    }
}

async function updateBalances() {
    if (!isConnected || !currentAccount) return;

    try {
        const [ethBal, gtBal] = await Promise.all([
            getETHBalance(currentAccount),
            getGTBalance(currentAccount)
        ]);

        ethBalance.textContent = `${parseFloat(ethBal).toFixed(4)} ETH`;
        gtBalance.textContent = `${parseFloat(gtBal).toFixed(2)} GT`;
    } catch (error) {
        console.error('Error updating balances:', error);
    }
}

async function updateUI() {
    if (isConnected) {
        await updateBalances();
        await loadMatches();
    }
}

// Token Purchase Functions
function calculateGTReceive() {
    const usdtAmount = parseFloat(usdtAmountInput.value) || 0;
    const gtAmount = usdtAmount; // 1:1 ratio
    gtReceiveInput.value = gtAmount.toFixed(6);
}

async function approveUSDTTokens() {
    try {
        if (!isConnected) {
            showStatus('Please connect your wallet first', 'warning');
            return;
        }

        const amount = parseFloat(usdtAmountInput.value);
        if (!amount || amount <= 0) {
            showStatus('Please enter a valid USDT amount', 'warning');
            return;
        }

        showLoading(true);
        showStatus('Approving USDT tokens...', 'info');

        await approveUSDT(amount);

        purchaseGTBtn.disabled = false;
        showStatus('USDT approved successfully!', 'success');

    } catch (error) {
        console.error('Error approving USDT:', error);
        showStatus('Failed to approve USDT: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function buyGameTokens() {
    try {
        if (!isConnected) {
            showStatus('Please connect your wallet first', 'warning');
            return;
        }

        const amount = parseFloat(usdtAmountInput.value);
        if (!amount || amount <= 0) {
            showStatus('Please enter a valid USDT amount', 'warning');
            return;
        }

        showLoading(true);
        showStatus('Purchasing GameTokens...', 'info');

        const receipt = await purchaseGameTokens(amount);

        // Reset form
        usdtAmountInput.value = '';
        gtReceiveInput.value = '';
        purchaseGTBtn.disabled = true;

        // Update balances
        await updateBalances();

        addTransaction('Token Purchase', `${amount} USDT → ${amount} GT`, receipt.transactionHash);
        showStatus('GameTokens purchased successfully!', 'success');

    } catch (error) {
        console.error('Error purchasing GameTokens:', error);
        showStatus('Failed to purchase GameTokens: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Match Functions
async function approveGameTokensForMatch() {
    try {
        if (!isConnected) {
            showStatus('Please connect your wallet first', 'warning');
            return;
        }

        const amount = parseFloat(stakeAmountInput.value);
        if (!amount || amount <= 0) {
            showStatus('Please enter a valid stake amount', 'warning');
            return;
        }

        showLoading(true);
        showStatus('Approving GameTokens...', 'info');

        await approveGameTokens(amount);

        createMatchBtn.disabled = false;
        showStatus('GameTokens approved successfully!', 'success');

    } catch (error) {
        console.error('Error approving GameTokens:', error);
        showStatus('Failed to approve GameTokens: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function createNewMatch() {
    try {
        if (!isConnected) {
            showStatus('Please connect your wallet first', 'warning');
            return;
        }

        const amount = parseFloat(stakeAmountInput.value);
        if (!amount || amount <= 0) {
            showStatus('Please enter a valid stake amount', 'warning');
            return;
        }

        showLoading(true);
        showStatus('Creating match...', 'info');

        const receipt = await createMatch(amount);

        // Reset form
        stakeAmountInput.value = '';
        createMatchBtn.disabled = true;

        // Update UI
        await updateBalances();
        await loadMatches();

        addTransaction('Match Created', `Stake: ${amount} GT`, receipt.transactionHash);
        showStatus('Match created successfully!', 'success');

    } catch (error) {
        console.error('Error creating match:', error);
        showStatus('Failed to create match: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function joinExistingMatch(matchId) {
    try {
        if (!isConnected) {
            showStatus('Please connect your wallet first', 'warning');
            return;
        }

        showLoading(true);
        showStatus('Joining match...', 'info');

        const receipt = await joinMatch(matchId);

        // Update UI
        await updateBalances();
        await loadMatches();

        addTransaction('Match Joined', `Match ID: ${matchId}`, receipt.transactionHash);
        showStatus('Joined match successfully!', 'success');

    } catch (error) {
        console.error('Error joining match:', error);
        showStatus('Failed to join match: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Match Display
async function loadMatches() {
    try {
        const pendingMatches = await getPendingMatches();
        displayMatches(pendingMatches);
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

function displayMatches(matches) {
    if (matches.length === 0) {
        matchesList.innerHTML = `
            <div class="text-gray-400 text-center py-8">
                <i class="fas fa-search text-4xl mb-4"></i>
                <p>No matches available. Create one to get started!</p>
            </div>
        `;
        return;
    }

    matchesList.innerHTML = matches.map(match => `
        <div class="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
            <div>
                <div class="font-semibold">Match #${match.id}</div>
                <div class="text-sm text-gray-400">
                    Stake: ${match.stakeAmount} GT | 
                    Created: ${match.createdAt.toLocaleDateString()}
                </div>
                <div class="text-xs text-gray-500">
                    Player: ${match.player1.substring(0, 10)}...
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <div class="text-right">
                    <div class="text-sm text-gray-400">Potential Win</div>
                    <div class="font-semibold text-green-400">${(parseFloat(match.stakeAmount) * 1.95).toFixed(2)} GT</div>
                </div>
                ${match.player1.toLowerCase() !== currentAccount.toLowerCase() ?
            `<button onclick="joinExistingMatch(${match.id})" 
                     class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors">
                        Join Match
                     </button>` :
            `<span class="text-yellow-400 text-sm">Your Match</span>`
        }
            </div>
        </div>
    `).join('');
}

// Utility Functions
function showStatus(message, type = 'info') {
    statusText.textContent = message;
    statusMessage.className = `fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-lg ${type === 'success' ? 'bg-green-600' :
            type === 'error' ? 'bg-red-600' :
                type === 'warning' ? 'bg-yellow-600' :
                    'bg-purple-600'
        } text-white`;

    statusMessage.classList.remove('hidden');

    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 5000);
}

function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function addTransaction(type, details, txHash) {
    const transactionDiv = document.createElement('div');
    transactionDiv.className = 'bg-gray-700 rounded-lg p-3 flex justify-between items-center';
    transactionDiv.innerHTML = `
        <div>
            <div class="font-medium">${type}</div>
            <div class="text-sm text-gray-400">${details}</div>
        </div>
        <a href="${NETWORKS[CURRENT_NETWORK].blockExplorerUrls[0]}tx/${txHash}" 
           target="_blank" 
           class="text-purple-400 hover:text-purple-300">
            <i class="fas fa-external-link-alt"></i>
        </a>
    `;

    // Add to top of transaction history
    if (transactionHistory.children.length === 1 && transactionHistory.children[0].textContent.includes('No transactions')) {
        transactionHistory.innerHTML = '';
    }

    transactionHistory.insertBefore(transactionDiv, transactionHistory.firstChild);

    // Keep only last 10 transactions
    while (transactionHistory.children.length > 10) {
        transactionHistory.removeChild(transactionHistory.lastChild);
    }
}

// Handle account changes
if (window.ethereum) {
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
            // User disconnected wallet
            location.reload();
        } else if (accounts[0] !== currentAccount) {
            // User switched accounts
            location.reload();
        }
    });

    window.ethereum.on('chainChanged', function (chainId) {
        // User switched networks
        location.reload();
    });
}
