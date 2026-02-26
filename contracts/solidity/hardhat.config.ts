import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

// =============================================================================
// CURRENT DEPLOYMENT: opBNB Testnet (--network opbnbTestnet)
// After validation, uncomment opBNB mainnet below and use --network opbnbMainnet
// BSC networks are kept commented for alternate deployment; uncomment when needed.
// =============================================================================

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
        },
    },
    networks: {
        // -------- opBNB (current) --------
        // opBNB Testnet — active; use for deploy now
        opbnbTestnet: {
            url: process.env.OPBNB_RPC_URL || "https://opbnb-testnet-rpc.publicnode.com",
            chainId: 5611,
            accounts: process.env.DEPLOYER_PRIVATE_KEY
                ? [process.env.DEPLOYER_PRIVATE_KEY]
                : [],
        },
        // opBNB Mainnet — uncomment when ready for production
        // opbnbMainnet: {
        //     url: process.env.OPBNB_MAINNET_RPC_URL || "https://opbnb-mainnet-rpc.bnbchain.org",
        //     chainId: 204,
        //     accounts: process.env.DEPLOYER_PRIVATE_KEY
        //         ? [process.env.DEPLOYER_PRIVATE_KEY]
        //         : [],
        // },

        // -------- BSC (commented; uncomment to use) --------
        // bscTestnet: {
        //     url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
        //     chainId: 97,
        //     accounts: process.env.DEPLOYER_PRIVATE_KEY
        //         ? [process.env.DEPLOYER_PRIVATE_KEY]
        //         : [],
        // },
        // bscMainnet: {
        //     url: process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed.binance.org",
        //     chainId: 56,
        //     accounts: process.env.DEPLOYER_PRIVATE_KEY
        //         ? [process.env.DEPLOYER_PRIVATE_KEY]
        //         : [],
        // },

        // Local / testing
        localhost: {
            url: "http://127.0.0.1:8545",
        },
        hardhat: {
            chainId: 31337,
        },
    },
    etherscan: {
        apiKey: {
            opbnbTestnet: process.env.BSCSCAN_API_KEY || "",
            // opbnbMainnet: process.env.BSCSCAN_API_KEY || "",
            // bscTestnet: process.env.BSCSCAN_API_KEY || "",
            // bscMainnet: process.env.BSCSCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "opbnbTestnet",
                chainId: 5611,
                urls: {
                    apiURL: "https://opbnb-testnet.bscscan.com/api",
                    browserURL: "https://opbnb-testnet.bscscan.com",
                },
            },
            // opBNB Mainnet — uncomment when verifying on mainnet
            // { network: "opbnbMainnet", chainId: 204, urls: { apiURL: "https://opbnb.bscscan.com/api", browserURL: "https://opbnb.bscscan.com" } },
            // BSC Testnet
            // { network: "bscTestnet", chainId: 97, urls: { apiURL: "https://api-testnet.bscscan.com/api", browserURL: "https://testnet.bscscan.com" } },
            // BSC Mainnet
            // { network: "bscMainnet", chainId: 56, urls: { apiURL: "https://api.bscscan.com/api", browserURL: "https://bscscan.com" } },
        ],
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

export default config;
