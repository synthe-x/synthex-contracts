# SyntheX

Comprises of contracts to deposit, withdraw, issue and burn synthetic assets on-chain.
Allows users to generate over-collateralized assets backed by [price-stabilized and natively issued] tokens such $TRON and $USDD on Tron Network and $ETH on Ethereum Network.

## Issuance

To issue new $x tokens, user has to provide collateral with native tokens. Against the value of collateral, user should be able to issue tokens with minimum 150% collateralization ratio

## Exchange

Users can exchange assets against some issuer collateral pool

### Issuer Collateral Pool (icPool)

This cPool consists on only the issuers debt

### Multi-Issuer Collateral Pool (mcPool)

This cPool is made of up multiple participants

## Instructions

Clone

```git clone https://github.com/synthe-x/synthex-contracts```

Install packages

```npm i``` or ```yarn```

### Deployment

- Development: ```npx hardhat run scripts```
- Testnet: ```npx hardhat run scripts --network testnet```
- Mainnet: ```npx hardhat run scripts --network mainnet```

### Tests

- ```npx hardhat test```
