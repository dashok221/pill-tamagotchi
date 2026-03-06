import { useState, useCallback, useEffect } from 'react';
import { useBlockchain, PILL_CONTRACT } from './hooks/useBlockchain';
import { useTamagotchi, ACTION_COSTS, type ActionType, type PetState, type PetMood } from './hooks/useTamagotchi';

function formatPill(amount: number): string {
    if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
    if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
    return amount.toLocaleString();
}

function formatPillBal(bal: bigint, dec: number): string {
    if (bal === 0n) return '0';
    const divisor = 10n ** BigInt(dec);
    const whole = bal / divisor;
    const frac = bal % divisor;
    const fracStr = frac.toString().padStart(dec, '0').slice(0, 2).replace(/0+$/, '');
    return Number(whole).toLocaleString() + (fracStr ? '.' + fracStr : '');
}

function truncAddr(a: string): string {
    if (!a || a.length <= 16) return a || '';
    return a.slice(0, 8) + '...' + a.slice(-6);
}

function formatSats(sats: number): string {
    return (sats / 1e8).toFixed(4) + ' BTC';
}

const POOP_POSITIONS = [
    { left: '12%', bottom: '8%' },
    { right: '12%', bottom: '12%' },
    { left: '22%', bottom: '22%' },
    { right: '22%', bottom: '4%' },
    { left: '5%', bottom: '30%' },
    { right: '5%', bottom: '28%' },
];

const MOOD_FACES: Record<PetMood, string> = {
    happy: '😊',
    content: '🙂',
    hungry: '😫',
    dirty: '😖',
    sad: '😢',
    sick: '🤢',
    sleeping: '😴',
    dead: '💀',
};

const STAGE_LABELS: Record<string, string> = {
    egg: '🥚 Egg',
    baby: '🍼 Baby',
    child: '🧒 Child',
    teen: '🧑 Teen',
    adult: '👑 Adult',
};

const ACTION_ICONS: Record<ActionType, string> = {
    feed: '🍔',
    clean: '🧹',
    play: '🎮',
    medicine: '💉',
    sleep: '💤',
    revive: '✨',
};

const ACTION_LABELS: Record<ActionType, string> = {
    feed: 'Feed',
    clean: 'Clean',
    play: 'Play',
    medicine: 'Medicine',
    sleep: 'Sleep',
    revive: 'Revive',
};

function StatBar({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
    const barColor = value > 60 ? color : value > 30 ? '#f0a000' : '#ff4444';
    return (
        <div className="stat-bar">
            <div className="stat-bar-header">
                <span className="stat-bar-icon">{icon}</span>
                <span className="stat-bar-label">{label}</span>
                <span className="stat-bar-value" style={{ color: barColor }}>{Math.round(value)}%</span>
            </div>
            <div className="stat-bar-track">
                <div
                    className="stat-bar-fill"
                    style={{ width: `${value}%`, background: barColor }}
                />
            </div>
        </div>
    );
}

function PetVisual({ pet, mood }: { pet: PetState; mood: PetMood }) {
    const isEgg = pet.stage === 'egg';

    return (
        <div className={`pet-scene mood-${mood} stage-${pet.stage}`}>
            {/* Poops around the pet */}
            {Array.from({ length: pet.poops }).map((_, i) => (
                <div
                    key={i}
                    className="poop"
                    style={POOP_POSITIONS[i] || { left: '50%', bottom: '5%' }}
                >
                    💩
                </div>
            ))}

            {/* Pet body */}
            <div className={`pet-body ${!pet.alive ? 'dead' : ''} ${pet.isSleeping ? 'sleeping' : ''}`}>
                {isEgg ? (
                    <div className="egg-crack">
                        <span className="egg-emoji">🥚</span>
                        <div className="egg-wiggle" />
                    </div>
                ) : (
                    <>
                        <div className="pet-face">{MOOD_FACES[mood]}</div>
                        {pet.stage !== 'egg' && !pet.alive && (
                            <div className="pet-ghost">👻</div>
                        )}
                    </>
                )}
            </div>

            {/* Effects */}
            {pet.isSleeping && pet.alive && (
                <div className="sleep-zzz">
                    <span className="zzz z1">z</span>
                    <span className="zzz z2">Z</span>
                    <span className="zzz z3">Z</span>
                </div>
            )}
            {mood === 'happy' && pet.alive && (
                <div className="sparkle-container">
                    <span className="sparkle s1">✨</span>
                    <span className="sparkle s2">⭐</span>
                    <span className="sparkle s3">✨</span>
                </div>
            )}
            {mood === 'sick' && pet.alive && (
                <div className="sick-swirl">
                    <span className="swirl">🌀</span>
                </div>
            )}
            {pet.deathTime && pet.alive && (
                <div className="death-warning">⚠️ Dying!</div>
            )}
        </div>
    );
}

export function App() {
    const bc = useBlockchain();
    const tama = useTamagotchi();
    const [newPetName, setNewPetName] = useState('');
    const [actionLoading, setActionLoading] = useState<ActionType | null>(null);
    const [txStatus, setTxStatus] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [, setTick] = useState(0);

    // Force re-render for age display
    useEffect(() => {
        if (!tama.pet) return;
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [tama.pet]);

    // Load PILL balance when connected
    useEffect(() => {
        if (bc.connected) {
            bc.loadPillBalance();
        }
    }, [bc.connected]);

    const handleAction = useCallback(async (action: ActionType) => {
        if (actionLoading) return;
        if (!tama.pet) return;

        // Sleep is free — no transaction
        if (action === 'sleep') {
            tama.applyAction('sleep');
            return;
        }

        // Pre-validate
        if (action === 'clean' && tama.pet.poops <= 0) {
            bc.setError('Nothing to clean! No poops yet.');
            return;
        }
        if (action === 'play' && tama.pet.energy < 10) {
            bc.setError('Too tired to play! Let your pet sleep first.');
            return;
        }
        if (action === 'medicine' && !tama.pet.isSick) {
            bc.setError('Pet is not sick!');
            return;
        }
        if (action === 'revive' && tama.pet.alive) return;
        if (action === 'feed' && tama.pet.stage === 'egg') {
            bc.setError("Can't feed an egg! Wait for it to hatch.");
            return;
        }

        // Check wallet and balance
        if (!bc.connected) {
            bc.setError('Connect your wallet first!');
            return;
        }

        const cost = ACTION_COSTS[action];
        if (!bc.pillInfo || bc.pillInfo.balance <= 0n) {
            bc.setError('No $PILL tokens! Get tokens on OP_NET testnet.');
            return;
        }

        const decimals = bc.pillInfo.decimals;
        const realBal = Number(bc.pillInfo.balance / (10n ** BigInt(decimals)));
        if (cost > realBal) {
            bc.setError(`Need ${cost} $PILL but you only have ${formatPill(realBal)}`);
            return;
        }

        // Transfer
        setActionLoading(action);
        setTxStatus(`💊 Sign "${ACTION_LABELS[action]}" in your wallet...`);
        try {
            const rawAmount = BigInt(cost) * (10n ** BigInt(decimals));
            await bc.transferPill(rawAmount);
            tama.applyAction(action);
            setTxStatus(`✅ ${ACTION_LABELS[action]} done! -${cost} $PILL`);
            await bc.loadPillBalance();
        } catch (e: any) {
            const msg = e?.message || 'Transaction cancelled';
            setTxStatus(`❌ Failed: ${msg.slice(0, 80)}`);
        } finally {
            setActionLoading(null);
            setTimeout(() => setTxStatus(''), 5000);
        }
    }, [actionLoading, bc, tama]);

    const handleCreatePet = useCallback(() => {
        const name = newPetName.trim() || 'Pilly';
        tama.createPet(name);
        setNewPetName('');
    }, [newPetName, tama]);

    const handleDeletePet = useCallback(() => {
        tama.deletePet();
        setShowDeleteConfirm(false);
    }, [tama]);

    const health = tama.getHealth();
    const age = tama.getAge();

    // ─── CREATE PET SCREEN ───
    if (!tama.pet) {
        return (
            <div className="app">
                <header className="header">
                    <div className="logo">
                        <span className="logo-pill">💊</span>
                        <span className="logo-text">PILL PET</span>
                        <span className="logo-sub">Tamagotchi</span>
                    </div>
                    <div className="header-right">
                        {bc.connected ? (
                            <div className="wallet-info">
                                <span className="wallet-bal">{formatSats(bc.btcTotal)}</span>
                                <button className="btn-wallet connected" onClick={bc.disconnectWallet}>
                                    {truncAddr(bc.walletAddress)}
                                </button>
                            </div>
                        ) : (
                            <button className="btn-wallet" onClick={bc.connectWallet} disabled={bc.loading}>
                                {bc.loading ? 'Connecting...' : 'Connect OP_WALLET'}
                            </button>
                        )}
                    </div>
                </header>

                <main className="create-screen">
                    <div className="create-card">
                        <div className="create-egg">🥚</div>
                        <h1 className="create-title">Hatch Your PILL Pet!</h1>
                        <p className="create-desc">
                            A Tamagotchi living on Bitcoin L1. Feed it, clean up after it,
                            play with it — all powered by <strong>$PILL</strong> tokens on OP_NET.
                        </p>
                        <div className="create-form">
                            <input
                                className="create-input"
                                placeholder="Name your pet..."
                                value={newPetName}
                                onChange={e => setNewPetName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreatePet()}
                                maxLength={20}
                            />
                            <button className="btn-hatch" onClick={handleCreatePet}>
                                🐣 Hatch!
                            </button>
                        </div>
                        <div className="create-costs">
                            <h3>Care Costs</h3>
                            <div className="cost-grid">
                                {(['feed', 'clean', 'play', 'medicine', 'revive'] as ActionType[]).map(a => (
                                    <div key={a} className="cost-item">
                                        <span>{ACTION_ICONS[a]}</span>
                                        <span>{ACTION_LABELS[a]}</span>
                                        <span className="cost-pill">{ACTION_COSTS[a]} $PILL</span>
                                    </div>
                                ))}
                                <div className="cost-item">
                                    <span>💤</span>
                                    <span>Sleep</span>
                                    <span className="cost-free">Free</span>
                                </div>
                            </div>
                        </div>
                        {!bc.connected && (
                            <p className="create-hint">
                                Connect your <strong>OP_WALLET</strong> to start caring for your pet!
                            </p>
                        )}
                    </div>
                </main>

                <footer className="footer">
                    <div className="footer-left">
                        Built on <a href="https://opnet.org" target="_blank" rel="noreferrer">OP_NET</a> • Bitcoin L1
                    </div>
                    <div className="footer-right">
                        Powered by BOB • #opnetvibecode
                    </div>
                </footer>
            </div>
        );
    }

    // ─── MAIN GAME SCREEN ───
    const { pet, mood } = tama;
    const canAct = (action: ActionType): boolean => {
        if (actionLoading) return false;
        if (!pet.alive && action !== 'revive') return false;
        if (action === 'feed' && pet.stage === 'egg') return false;
        if (action === 'clean' && pet.poops <= 0) return false;
        if (action === 'play' && (pet.stage === 'egg' || pet.energy < 10)) return false;
        if (action === 'medicine' && !pet.isSick) return false;
        if (action === 'revive' && pet.alive) return false;
        if (action === 'sleep') return pet.alive;
        return true;
    };

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <div className="logo">
                    <span className="logo-pill">💊</span>
                    <span className="logo-text">PILL PET</span>
                    <span className="logo-sub">Tamagotchi</span>
                </div>
                <div className="header-right">
                    {bc.connected ? (
                        <div className="wallet-info">
                            <span className="wallet-bal">{formatSats(bc.btcTotal)}</span>
                            {bc.pillInfo && (
                                <span className="pill-bal-header">
                                    💊 {formatPillBal(bc.pillInfo.balance, bc.pillInfo.decimals)}
                                </span>
                            )}
                            <button className="btn-wallet connected" onClick={bc.disconnectWallet}>
                                {truncAddr(bc.walletAddress)}
                            </button>
                        </div>
                    ) : (
                        <button className="btn-wallet" onClick={bc.connectWallet} disabled={bc.loading}>
                            {bc.loading ? 'Connecting...' : 'Connect OP_WALLET'}
                        </button>
                    )}
                </div>
            </header>

            {/* Transaction Status */}
            {txStatus && (
                <div className={`tx-bar ${txStatus.startsWith('✅') ? 'tx-ok' : txStatus.startsWith('❌') ? 'tx-err' : 'tx-pending'}`}>
                    {txStatus}
                </div>
            )}

            {/* Main Game */}
            <main className="game-area">
                {/* LEFT: Pet + Actions */}
                <div className="game-left">
                    {/* Pet Name & Stage */}
                    <div className="pet-header">
                        <h2 className="pet-name">{pet.name}</h2>
                        <span className="pet-stage">{STAGE_LABELS[pet.stage]}</span>
                        <span className="pet-age">Age: {age}</span>
                    </div>

                    {/* Pet Visual */}
                    <PetVisual pet={pet} mood={mood} />

                    {/* Action Buttons */}
                    <div className="actions-grid">
                        {pet.alive ? (
                            <>
                                <button
                                    className={`btn-action feed ${actionLoading === 'feed' ? 'loading' : ''}`}
                                    onClick={() => handleAction('feed')}
                                    disabled={!canAct('feed')}
                                >
                                    <span className="action-icon">🍔</span>
                                    <span className="action-name">Feed</span>
                                    <span className="action-cost">{ACTION_COSTS.feed} $PILL</span>
                                </button>
                                <button
                                    className={`btn-action clean ${actionLoading === 'clean' ? 'loading' : ''}`}
                                    onClick={() => handleAction('clean')}
                                    disabled={!canAct('clean')}
                                >
                                    <span className="action-icon">🧹</span>
                                    <span className="action-name">Clean</span>
                                    <span className="action-cost">{ACTION_COSTS.clean} $PILL</span>
                                    {pet.poops > 0 && <span className="poop-badge">{pet.poops}💩</span>}
                                </button>
                                <button
                                    className={`btn-action play ${actionLoading === 'play' ? 'loading' : ''}`}
                                    onClick={() => handleAction('play')}
                                    disabled={!canAct('play')}
                                >
                                    <span className="action-icon">🎮</span>
                                    <span className="action-name">Play</span>
                                    <span className="action-cost">{ACTION_COSTS.play} $PILL</span>
                                </button>
                                <button
                                    className={`btn-action sleep ${pet.isSleeping ? 'active' : ''}`}
                                    onClick={() => handleAction('sleep')}
                                    disabled={!canAct('sleep')}
                                >
                                    <span className="action-icon">💤</span>
                                    <span className="action-name">{pet.isSleeping ? 'Wake Up' : 'Sleep'}</span>
                                    <span className="action-cost">Free</span>
                                </button>
                                {pet.isSick && (
                                    <button
                                        className={`btn-action medicine ${actionLoading === 'medicine' ? 'loading' : ''}`}
                                        onClick={() => handleAction('medicine')}
                                        disabled={!canAct('medicine')}
                                    >
                                        <span className="action-icon">💉</span>
                                        <span className="action-name">Medicine</span>
                                        <span className="action-cost">{ACTION_COSTS.medicine} $PILL</span>
                                    </button>
                                )}
                            </>
                        ) : (
                            <button
                                className={`btn-action revive ${actionLoading === 'revive' ? 'loading' : ''}`}
                                onClick={() => handleAction('revive')}
                                disabled={!canAct('revive')}
                            >
                                <span className="action-icon">✨</span>
                                <span className="action-name">Revive</span>
                                <span className="action-cost">{ACTION_COSTS.revive} $PILL</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT: Stats + Info */}
                <div className="game-right">
                    {/* Health Overview */}
                    <div className="health-card">
                        <div className="health-circle" style={{
                            background: `conic-gradient(${health > 60 ? '#22c55e' : health > 30 ? '#f0a000' : '#ff4444'} ${health * 3.6}deg, #1a1a2e ${health * 3.6}deg)`
                        }}>
                            <div className="health-inner">
                                <span className="health-val">{health}</span>
                                <span className="health-label">HP</span>
                            </div>
                        </div>
                        <div className="health-mood">
                            <span className="mood-emoji">{MOOD_FACES[mood]}</span>
                            <span className="mood-label">{mood.charAt(0).toUpperCase() + mood.slice(1)}</span>
                        </div>
                    </div>

                    {/* Stat Bars */}
                    <div className="stats-section">
                        <StatBar label="Hunger" value={pet.hunger} icon="🍖" color="#22c55e" />
                        <StatBar label="Clean" value={pet.cleanliness} icon="🧼" color="#3b82f6" />
                        <StatBar label="Happy" value={pet.happiness} icon="😊" color="#f59e0b" />
                        <StatBar label="Energy" value={pet.energy} icon="⚡" color="#a855f7" />
                    </div>

                    {/* Pet Info */}
                    <div className="info-section">
                        <h3 className="section-title">📋 Info</h3>
                        <div className="info-grid">
                            <div className="info-row">
                                <span className="info-label">Total Actions</span>
                                <span className="info-val">{pet.totalActions}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">$PILL Spent</span>
                                <span className="info-val">{formatPill(pet.totalPillSpent)}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Poops</span>
                                <span className="info-val">{pet.poops > 0 ? `${pet.poops} 💩` : 'Clean!'}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Sick</span>
                                <span className="info-val">{pet.isSick ? '🤒 Yes' : '❤️ No'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Log */}
                    <div className="log-section">
                        <h3 className="section-title">📜 Recent</h3>
                        <div className="log-list">
                            {pet.actionLog.length === 0 && (
                                <p className="log-empty">No actions yet — care for your pet!</p>
                            )}
                            {pet.actionLog.slice(0, 10).map((entry, i) => (
                                <div key={i} className="log-item">
                                    <span className="log-icon">{ACTION_ICONS[entry.action]}</span>
                                    <span className="log-action">{ACTION_LABELS[entry.action]}</span>
                                    <span className="log-cost">-{entry.cost} $PILL</span>
                                    <span className="log-time">
                                        {Math.round((Date.now() - entry.timestamp) / 60000)}m ago
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contract Info */}
                    <div className="contract-section">
                        <span className="ci-label">$PILL Contract</span>
                        <code className="ci-addr">{PILL_CONTRACT.slice(0, 10)}...{PILL_CONTRACT.slice(-8)}</code>
                    </div>

                    {/* Delete Pet */}
                    <div className="danger-zone">
                        {showDeleteConfirm ? (
                            <div className="delete-confirm">
                                <span>Release pet forever?</span>
                                <button className="btn-confirm-yes" onClick={handleDeletePet}>Yes</button>
                                <button className="btn-confirm-no" onClick={() => setShowDeleteConfirm(false)}>No</button>
                            </div>
                        ) : (
                            <button className="btn-delete" onClick={() => setShowDeleteConfirm(true)}>
                                Release Pet
                            </button>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-left">
                    Built on <a href="https://opnet.org" target="_blank" rel="noreferrer">OP_NET</a> • Bitcoin L1
                    {' • '}
                    <a
                        href="https://chromewebstore.google.com/detail/opwallet/pmbjpcmaaladnfpacpmhmnfmpklgbdjb"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Get OP_WALLET
                    </a>
                </div>
                <div className="footer-right">
                    Powered by BOB • #opnetvibecode
                </div>
            </footer>

            {/* Error Toast */}
            {bc.error && (
                <div className="error-toast" onClick={() => bc.setError('')}>
                    ⚠️ {bc.error}
                </div>
            )}
        </div>
    );
}
