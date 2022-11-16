import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import deploy from '../scripts/deploy';

describe('Testing helpers', function () {
	let limitOrder: Contract;
	let maker: SignerWithAddress, taker: SignerWithAddress;
	let storedSignature: string;
	let PriceOracle: any;
	let usdPrice = 0, btcPrice = 0, ethPrice = 0;
	let system: Contract, usdOracle: Contract, btcOracle: Contract, ethOracle: Contract, weth: Contract;
	let usdpool: any, btcpool: Contract;

	before(async () => {
		maker = (await ethers.getSigners())[0];
		taker = (await ethers.getSigners())[1];
		PriceOracle = await ethers.getContractFactory('MockPriceOracle');
		usdOracle = await PriceOracle.deploy();
		usdPrice = 1;
		await usdOracle.setPrice(usdPrice * 100000000);

		btcOracle = await PriceOracle.deploy();
		btcPrice = 20000;
		await btcOracle.setPrice(btcPrice * 100000000);

        ethOracle = await PriceOracle.deploy();
        ethPrice = 1500
        await ethOracle.setPrice(ethPrice*100000000)


		const deployments = await deploy();
		limitOrder = deployments.limit;
        weth = (deployments as any).weth;
        system = deployments.sys;
        let scxeth = (deployments as any).ceth
        await scxeth.setPriceOracle(ethOracle.address)
		// dusdpool = deployments.usddebt
		usdpool = (deployments as any).usdpool;
		await usdpool.setPriceOracle(usdOracle.address);
		// dbtcpool = deployments.btcddebt
		btcpool = (deployments as any).btcpool;
		await btcpool.setPriceOracle(btcOracle.address);
	});

	it('maker issues 1000 USDX, taker issues 0.1 BTCX', async () => {
        await weth.connect(maker).deposit();
        await weth.connect(maker).deposit();
        await weth.connect(maker).deposit();
        await weth.connect(maker).deposit();
        await weth.connect(maker).approve(system.address, ethers.utils.parseEther('1000'));
        await weth.connect(taker).deposit();
        await weth.connect(taker).deposit();
        await weth.connect(taker).deposit();
        await weth.connect(taker).deposit();
        await weth.connect(taker).approve(system.address, ethers.utils.parseEther('1000'));

        await system.connect(maker).deposit(weth.address, ethers.utils.parseEther('40'));
        await system.connect(maker).borrow(usdpool.address, ethers.utils.parseEther('10000'));

        await system.connect(taker).deposit(weth.address, ethers.utils.parseEther('40'));
        await system.connect(taker).borrow(btcpool.address, ethers.utils.parseEther('1'));

		expect(await usdpool.balanceOf(maker.address)).to.equal(ethers.utils.parseEther('10000'));
		expect(await btcpool.balanceOf(taker.address)).to.equal(ethers.utils.parseEther('1'));
    });

	it('account0 creates limit order to sell', async function () {
		const domain = {
			name: 'SyntheXLimitOrderDEX',
			version: '1',
			chainId: 1337,
			verifyingContract: limitOrder.address,
		};

		// The named list of all type definitions
		const types = {
			Order: [
				{ name: 'maker', type: 'address' },
				{ name: 'src', type: 'address' },
				{ name: 'dst', type: 'address' },
				{ name: 'srcAmount', type: 'uint256' },
			],
		};

		// The data to sign
		const value = {
			maker: maker.address,
			src: usdpool.address,
			dst: btcpool.address,
			srcAmount: ethers.utils.parseEther('1000').toString(),
		};

		// sign typed data
		storedSignature = await maker._signTypedData(domain, types, value);
	});

	it('send tx', async function () {
		await system.connect(taker).executeOrder(
					maker.address,
                    usdpool.address,
                    btcpool.address,
					ethers.utils.parseEther('1000').toString(),
					storedSignature
				)
		
		expect(await usdpool.balanceOf(maker.address)).to.equal(ethers.utils.parseEther('9000'));
		expect(await btcpool.balanceOf(maker.address)).to.equal(ethers.utils.parseEther('0.05'));

		expect(await usdpool.balanceOf(taker.address)).to.equal(ethers.utils.parseEther('1000'));
		expect(await btcpool.balanceOf(taker.address)).to.equal(ethers.utils.parseEther('0.95'));
	});
});
