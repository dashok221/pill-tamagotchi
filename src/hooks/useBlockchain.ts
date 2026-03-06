import { useState, useCallback, useRef } from 'react';
import { JSONRpcProvider, getContract, OP_20_ABI } from 'opnet';
import type { IOP20Contract } from 'opnet';
import { networks, fromBech32 } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import { useWalletConnect } from '@btc-vision/walletconnect';

const NETWORK = networks.opnetTestnet;
const RPC_URL = 'https://testnet.opnet.org';

// $PILL token contract on OP_NET testnet
export const PILL_CONTRACT = '0xb09fc29c112af8293539477e23d8df1d3126639642767d707277131352040cbb';

// Fee address — receives tokens spent on pet care actions
export const FEE_ADDRESS = 'opt1pqyq9pjq27a24fy092vy86gzglmr389fvns7ftk8csxecjj5qvytszyycdv';

export interface PillInfo {
    name: string;
    symbol: string;
    decimals: number;
    balance: bigint;
}

export function useBlockchain() {
    const wc = useWalletConnect();
    const providerRef = useRef<JSONRpcProvider | null>(null);

    const [pillInfo, setPillInfo] = useState<PillInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    function getProvider(): JSONRpcProvider {
        if (!providerRef.current) {
            providerRef.current = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
        }
        return providerRef.current;
    }

    const connected = !!wc.walletAddress;
    const walletAddress = wc.walletAddress ?? '';
    const btcTotal = wc.walletBalance?.total ?? 0;

    const connectWallet = useCallback(() => {
        wc.openConnectModal();
    }, [wc]);

    const disconnectWallet = useCallback(() => {
        wc.disconnect();
        setPillInfo(null);
    }, [wc]);

    const setErrorMsg = useCallback((msg: string) => setError(msg), []);

    const loadPillBalance = useCallback(async (): Promise<PillInfo | null> => {
        if (!wc.walletAddress) return null;

        try {
            setLoading(true);
            setError('');
            const provider = getProvider();

            const contract = getContract<IOP20Contract>(
                PILL_CONTRACT,
                OP_20_ABI,
                provider,
                NETWORK,
                wc.address ?? undefined,
            );

            let name = 'PILL';
            let symbol = 'PILL';
            let decimals = 8;

            try {
                const meta = await contract.metadata();
                name = meta.properties.name || name;
                symbol = meta.properties.symbol || symbol;
                decimals = Number(meta.properties.decimals ?? 8);
            } catch {
                // Use defaults
            }

            let balance = 0n;

            // Strategy A: wc.address directly
            if (wc.address) {
                try {
                    const bal = await contract.balanceOf(wc.address);
                    if (!('error' in bal)) {
                        balance = bal.properties.balance ?? 0n;
                    }
                } catch { /* try next */ }
            }

            // Strategy B: getPublicKeyInfo
            if (balance === 0n && wc.walletAddress) {
                try {
                    const resolved = await provider.getPublicKeyInfo(wc.walletAddress, false);
                    if (resolved) {
                        const bal = await contract.balanceOf(resolved);
                        if (!('error' in bal)) {
                            balance = bal.properties.balance ?? 0n;
                        }
                    }
                } catch { /* skip */ }
            }

            // Strategy C: mldsaPublicKey
            if (balance === 0n && (wc as any).mldsaPublicKey) {
                try {
                    const mldsaKey = (wc as any).mldsaPublicKey as string;
                    const addr = Address.fromString(mldsaKey, wc.publicKey || undefined);
                    const bal = await contract.balanceOf(addr);
                    if (!('error' in bal)) {
                        balance = bal.properties.balance ?? 0n;
                    }
                } catch { /* skip */ }
            }

            const info: PillInfo = { name, symbol, decimals, balance };
            setPillInfo(info);
            return info;
        } catch (err: any) {
            setError(err?.message || 'Failed to load PILL balance');
            return null;
        } finally {
            setLoading(false);
        }
    }, [wc.address, wc.walletAddress, wc.publicKey, (wc as any).mldsaPublicKey]);

    const transferPill = useCallback(async (amount: bigint): Promise<string> => {
        if (!wc.walletAddress || !wc.address) {
            throw new Error('Wallet not connected');
        }

        const provider = getProvider();
        const contract = getContract<IOP20Contract>(
            PILL_CONTRACT,
            OP_20_ABI,
            provider,
            NETWORK,
            wc.address,
        );

        let feeAddr: Address | undefined;
        try {
            feeAddr = await provider.getPublicKeyInfo(FEE_ADDRESS, false);
        } catch { /* skip */ }

        if (!feeAddr) {
            const decoded = fromBech32(FEE_ADDRESS);
            feeAddr = Address.wrap(decoded.data);
        }

        const simulation = await contract.transfer(feeAddr, amount);
        if (simulation.revert) {
            throw new Error(`Transfer would fail: ${simulation.revert}`);
        }

        const receipt = await simulation.sendTransaction({
            signer: wc.signer ?? null,
            mldsaSigner: null,
            refundTo: wc.walletAddress,
            maximumAllowedSatToSpend: 100000n,
            feeRate: 10,
            network: NETWORK,
        });

        return typeof receipt === 'object' && receipt !== null
            ? JSON.stringify(receipt)
            : String(receipt);
    }, [wc.address, wc.walletAddress, wc.signer]);

    return {
        connected,
        walletAddress,
        btcTotal,
        pillInfo,
        loading,
        error,
        setError: setErrorMsg,
        connectWallet,
        disconnectWallet,
        loadPillBalance,
        transferPill,
    };
}
