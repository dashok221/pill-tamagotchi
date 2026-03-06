import { useState, useCallback, useEffect, useRef } from 'react';

export type PetStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult';
export type PetMood = 'happy' | 'content' | 'hungry' | 'dirty' | 'sad' | 'sick' | 'sleeping' | 'dead';
export type ActionType = 'feed' | 'clean' | 'play' | 'medicine' | 'sleep' | 'revive';

export interface ActionLogEntry {
    action: ActionType;
    timestamp: number;
    cost: number;
}

export interface PetState {
    name: string;
    hunger: number;
    cleanliness: number;
    happiness: number;
    energy: number;
    alive: boolean;
    isSleeping: boolean;
    isSick: boolean;
    stage: PetStage;
    poops: number;
    lastUpdate: number;
    birthTime: number;
    totalActions: number;
    totalPillSpent: number;
    actionLog: ActionLogEntry[];
    deathTime: number | null;
    lastPoopTime: number;
}

// Costs in PILL display units
export const ACTION_COSTS: Record<ActionType, number> = {
    feed: 100,
    clean: 50,
    play: 75,
    medicine: 200,
    sleep: 0,
    revive: 500,
};

// Decay rates per second
const DECAY_RATES = {
    hunger: 0.09,
    cleanliness: 0.04,
    happiness: 0.065,
    energy: 0.03,
};

const POOP_INTERVAL = 90; // seconds
const MAX_POOPS = 6;

// Evolution thresholds in seconds
const STAGE_THRESHOLDS: [PetStage, number][] = [
    ['adult', 14400],  // 4 hours
    ['teen', 3600],    // 1 hour
    ['child', 900],    // 15 min
    ['baby', 180],     // 3 min
    ['egg', 0],
];

const STORAGE_KEY = 'pill-tamagotchi-pet';

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

function getStage(ageSeconds: number): PetStage {
    for (const [stage, threshold] of STAGE_THRESHOLDS) {
        if (ageSeconds >= threshold) return stage;
    }
    return 'egg';
}

export function getMood(pet: PetState): PetMood {
    if (!pet.alive) return 'dead';
    if (pet.isSleeping) return 'sleeping';
    if (pet.isSick) return 'sick';
    if (pet.hunger < 20) return 'hungry';
    if (pet.cleanliness < 20 || pet.poops >= 4) return 'dirty';
    if (pet.happiness < 20) return 'sad';
    if (pet.happiness > 70 && pet.hunger > 50 && pet.cleanliness > 50) return 'happy';
    return 'content';
}

function createNewPet(name: string): PetState {
    const now = Date.now();
    return {
        name,
        hunger: 80,
        cleanliness: 100,
        happiness: 80,
        energy: 100,
        alive: true,
        isSleeping: false,
        isSick: false,
        stage: 'egg',
        poops: 0,
        lastUpdate: now,
        birthTime: now,
        totalActions: 0,
        totalPillSpent: 0,
        actionLog: [],
        deathTime: null,
        lastPoopTime: now,
    };
}

function applyDecay(state: PetState, elapsedSeconds: number): void {
    if (state.isSleeping) {
        state.energy = clamp(state.energy + elapsedSeconds * 0.15, 0, 100);
        state.hunger = clamp(state.hunger - elapsedSeconds * DECAY_RATES.hunger * 0.5, 0, 100);
        state.happiness = clamp(state.happiness - elapsedSeconds * DECAY_RATES.happiness * 0.3, 0, 100);
    } else {
        state.hunger = clamp(state.hunger - elapsedSeconds * DECAY_RATES.hunger, 0, 100);
        state.cleanliness = clamp(state.cleanliness - elapsedSeconds * DECAY_RATES.cleanliness, 0, 100);
        state.happiness = clamp(state.happiness - elapsedSeconds * DECAY_RATES.happiness, 0, 100);
        state.energy = clamp(state.energy - elapsedSeconds * DECAY_RATES.energy, 0, 100);
    }

    // Extra decay from poops
    if (state.poops > 0) {
        state.cleanliness = clamp(state.cleanliness - state.poops * 0.02 * elapsedSeconds, 0, 100);
        state.happiness = clamp(state.happiness - state.poops * 0.01 * elapsedSeconds, 0, 100);
    }

    // Sickness accelerates decay
    if (state.isSick) {
        state.hunger = clamp(state.hunger - elapsedSeconds * 0.03, 0, 100);
        state.energy = clamp(state.energy - elapsedSeconds * 0.02, 0, 100);
    }
}

export function useTamagotchi() {
    const [pet, setPet] = useState<PetState | null>(null);
    const [mood, setMood] = useState<PetMood>('content');
    const tickRef = useRef<number | null>(null);

    // Load from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as PetState;
                const now = Date.now();
                const elapsed = (now - parsed.lastUpdate) / 1000;
                if (parsed.alive && elapsed > 0) {
                    applyDecay(parsed, elapsed);

                    // Offline poop gen
                    const offlinePoops = Math.floor(elapsed / POOP_INTERVAL);
                    if (offlinePoops > 0 && !parsed.isSleeping) {
                        parsed.poops = Math.min(parsed.poops + offlinePoops, MAX_POOPS);
                        parsed.cleanliness = clamp(parsed.cleanliness - offlinePoops * 10, 0, 100);
                    }

                    // Offline stage evolution
                    const ageSeconds = (now - parsed.birthTime) / 1000;
                    parsed.stage = getStage(ageSeconds);

                    // Offline sickness
                    const avgStat = (parsed.hunger + parsed.cleanliness + parsed.happiness) / 3;
                    if (avgStat < 15) parsed.isSick = true;

                    // Offline death
                    if (parsed.hunger <= 0 && parsed.cleanliness <= 0 && parsed.happiness <= 0) {
                        if (elapsed > 180) parsed.alive = false;
                    }

                    parsed.lastUpdate = now;
                    parsed.lastPoopTime = now;
                }
                setPet(parsed);
            }
        } catch { /* no saved pet */ }
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        if (pet) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pet));
            setMood(getMood(pet));
        }
    }, [pet]);

    // Game tick every second
    useEffect(() => {
        if (!pet || !pet.alive) return;

        tickRef.current = window.setInterval(() => {
            setPet(prev => {
                if (!prev || !prev.alive) return prev;
                const now = Date.now();
                const elapsed = (now - prev.lastUpdate) / 1000;
                if (elapsed < 1) return prev;

                const next = { ...prev };

                applyDecay(next, elapsed);

                // Poop generation
                const timeSinceLastPoop = (now - next.lastPoopTime) / 1000;
                if (timeSinceLastPoop >= POOP_INTERVAL && next.poops < MAX_POOPS && !next.isSleeping && next.stage !== 'egg') {
                    next.poops = Math.min(next.poops + 1, MAX_POOPS);
                    next.cleanliness = clamp(next.cleanliness - 10, 0, 100);
                    next.lastPoopTime = now;
                }

                // Evolution
                const ageSeconds = (now - next.birthTime) / 1000;
                next.stage = getStage(ageSeconds);

                // Sickness check
                const avgStat = (next.hunger + next.cleanliness + next.happiness) / 3;
                if (avgStat < 15 && !next.isSick) {
                    next.isSick = true;
                }

                // Death check - 3 minutes at zero stats
                if (next.hunger <= 0 && next.cleanliness <= 0 && next.happiness <= 0) {
                    if (!next.deathTime) {
                        next.deathTime = now;
                    } else if (now - next.deathTime > 180_000) {
                        next.alive = false;
                    }
                } else {
                    next.deathTime = null;
                }

                next.lastUpdate = now;
                return next;
            });
        }, 1000);

        return () => {
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, [pet?.alive]);

    const createPet = useCallback((name: string) => {
        const newPet = createNewPet(name);
        setPet(newPet);
    }, []);

    const applyAction = useCallback((action: ActionType) => {
        setPet(prev => {
            if (!prev) return prev;
            const next = { ...prev };

            switch (action) {
                case 'feed':
                    if (next.stage === 'egg') return prev;
                    next.hunger = clamp(next.hunger + 30, 0, 100);
                    next.happiness = clamp(next.happiness + 5, 0, 100);
                    break;
                case 'clean':
                    if (next.poops <= 0) return prev;
                    next.poops = Math.max(0, next.poops - 1);
                    next.cleanliness = clamp(next.cleanliness + 25, 0, 100);
                    next.happiness = clamp(next.happiness + 5, 0, 100);
                    break;
                case 'play':
                    if (next.stage === 'egg' || next.energy < 10) return prev;
                    next.happiness = clamp(next.happiness + 25, 0, 100);
                    next.energy = clamp(next.energy - 15, 0, 100);
                    next.hunger = clamp(next.hunger - 5, 0, 100);
                    break;
                case 'medicine':
                    if (!next.isSick) return prev;
                    next.isSick = false;
                    next.hunger = clamp(next.hunger + 10, 0, 100);
                    next.cleanliness = clamp(next.cleanliness + 10, 0, 100);
                    next.happiness = clamp(next.happiness + 10, 0, 100);
                    next.energy = clamp(next.energy + 10, 0, 100);
                    break;
                case 'sleep':
                    next.isSleeping = !next.isSleeping;
                    break;
                case 'revive':
                    if (next.alive) return prev;
                    next.alive = true;
                    next.hunger = 50;
                    next.cleanliness = 50;
                    next.happiness = 50;
                    next.energy = 50;
                    next.isSick = false;
                    next.isSleeping = false;
                    next.poops = 0;
                    next.deathTime = null;
                    break;
            }

            if (action !== 'sleep') {
                next.totalActions++;
                next.totalPillSpent += ACTION_COSTS[action];
                next.actionLog = [
                    { action, timestamp: Date.now(), cost: ACTION_COSTS[action] },
                    ...next.actionLog,
                ].slice(0, 50);
            }

            return next;
        });
    }, []);

    const deletePet = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setPet(null);
    }, []);

    const getHealth = useCallback((): number => {
        if (!pet) return 0;
        return Math.round((pet.hunger + pet.cleanliness + pet.happiness + pet.energy) / 4);
    }, [pet]);

    const getAge = useCallback((): string => {
        if (!pet) return '0s';
        const seconds = Math.floor((Date.now() - pet.birthTime) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainMin = minutes % 60;
        if (hours < 24) return `${hours}h ${remainMin}m`;
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    }, [pet]);

    return {
        pet,
        mood,
        createPet,
        applyAction,
        deletePet,
        getHealth,
        getAge,
    };
}
