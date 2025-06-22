
require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { Coinbase, Wallet } = require('@coinbase/coinbase-sdk');
const { MerkleTree }       = require('merkletreejs');
const keccak256            = require('keccak256');

Coinbase.configureFromJson({ filePath: './cdp_api_key.json' });

function loadCache(file) {
  const p = path.join(__dirname, file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}
function saveCache(file, obj) {
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(obj, null, 2));
}

const tokenCache   = loadCache('../token_cache.json');    
const airdropCache = loadCache('../airdrop_cache.json');  
const WALLET_ID   = '141207db-5ed5-4c29-9ad0-993ca58965e8';   
const WALLET_FILE = path.join(__dirname, '../treasury_wallet.json');
const NETWORK_ID  = Coinbase.networks.BaseSepolia;


let treasury = null;

async function getTreasury () {
  if (treasury) return treasury;

  if (fs.existsSync(WALLET_FILE)) {
    const jsonText = fs.readFileSync(WALLET_FILE, 'utf8');
    treasury       = await Wallet.import(JSON.parse(jsonText));
    return treasury;
  }

  treasury = await Wallet.fetch(WALLET_ID);

  const exportObj = await treasury.export();           
  fs.writeFileSync(WALLET_FILE, JSON.stringify(exportObj, null, 2));
  console.log('📄  Cached treasury_wallet.json for future runs');

  return treasury;
}


async function buildAirdropList () {
  const ADDRS = [
    '0x67A2E8A0c6B2b743Bb2CBe60c61De3E6D2F1C2a0',
    '0x1B6F92717B9C2f4C3a8836c1303d7770D7a6717E',
    '0x9c8A5B6792d3E4aE4f3F6cB0084cC5364C8c8992',
    '0x5d1e138901Bcf3F3d6A14B1147E1D2760b2cAb40',
  ];
  return ADDRS.map(a => ({ address: a, amount: 5 }));
}

async function deployToken (name, symbol, totalSupply) {

  if (tokenCache[symbol]) {
    console.log(`♻️  Re-using existing ${symbol} at`, tokenCache[symbol]);
    return {
      getContractAddress: () => tokenCache[symbol],
      waitForConfirmations: async () => {}
    };
  }

  const w   = await getTreasury();
  const adr = await w.getDefaultAddress();
  console.log(`📦  treasury wallet: ${adr}`);

  const token = await w.deployToken({ name, symbol, totalSupply });
  await token.waitForConfirmations?.();

  const tokAddr = token.getContractAddress();
  console.log('✅  ERC-20 deployed at', tokAddr);

  tokenCache[symbol] = tokAddr;
  saveCache('../token_cache.json', tokenCache);

  return token;
}



async function deployAirdrop (tokenAddr, recipients) {

  const leaves = recipients.map(r =>
    keccak256(r.address.toLowerCase() + r.amount.toString().padStart(64, '0'))
  );
  const root = new MerkleTree(leaves, keccak256, { sortPairs: true }).getHexRoot();

  const cacheKey = `${tokenAddr}|${root}`;

  if (airdropCache[cacheKey]) {
    const dropAddr = airdropCache[cacheKey];
    console.log('♻️  Re-using airdrop at', dropAddr);
    return {
      dropAddress: dropAddr,
      claimUrl: `${process.env.CLAIM_BASE || 'https://example.com'}/drop/${dropAddr}`
    };
  }

  console.log('🌳  Merkle root:', root);

  const w = await getTreasury();
  const buildInfo = fs.readFileSync(
    path.join(__dirname, '../clean_input.json'),
    'utf8'
  );
  const solidityInputJson = JSON.stringify(buildInfo.input);

const CONTRACT_FQN = 'contracts/MerkleAirdrop.sol:MerkleAirdrop'; 

  const airdropTx = await w.deployContract({
    solidityVersion:  '0.8.30+commit.73712a01',
    solidityInputJson,
    contractName:     CONTRACT_FQN,
    constructorArgs:  {
      _token:  tokenAddr,
      _root:   root,
      _expiry: 60 * 60 * 24 * 30
    }
  });

  console.log('⏳  Waiting for airdrop deployment…');

  await airdropTx.wait();
  const dropAddr = airdropTx.getContractAddress();
  console.log('✅  Merkle drop deployed at', dropAddr);

  const total = recipients.reduce((s, r) => s + r.amount, 0);
  await w.invokeContract({
    contractAddress: tokenAddr,
    method: 'transfer',
    args: { to: dropAddr, value: (total * 10n ** 18n).toString() },
    abi: [{
      inputs:  [{ name:'to', type:'address' },
                { name:'value', type:'uint256' }],
      name: 'transfer', outputs:[{ type:'bool' }], type:'function'
    }]
  });

  airdropCache[cacheKey] = dropAddr;
  saveCache('../airdrop_cache.json', airdropCache);

  return {
    dropAddress: dropAddr,
    claimUrl: `${process.env.CLAIM_BASE || 'https://example.com'}/drop/${dropAddr}`
  };
}

async function disburseTokens (tokenAddr, recipients) {
  const w = await getTreasury();

  const TRANSFER_ABI = [{
    inputs : [{ name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' }],
    name   : 'transfer',
    outputs: [{ type: 'bool' }],
    type   : 'function'
  }];

  for (const r of recipients) {
    /* 1️⃣ sign + send */
    const sig = await w.invokeContract({
      contractAddress: tokenAddr,
      method : 'transfer',
      args   : { to: r.address,
                 value: (BigInt(r.amount) * 10n ** 18n).toString() },
      abi    : TRANSFER_ABI
    });

    const receipt = await sig.wait();          

    const txHash =
          receipt?.transactionHash ||
          receipt?.hash            ||
          receipt?.id              ||
          'n/a';

    console.log(
      `→ sent ${r.amount} tokens to ${r.address}` +
      (txHash !== 'n/a' ? `  (tx ${txHash.slice(0,10)}…)` : '')
    );
  }

  console.log(`🎉  Finished – ${recipients.length} transfers confirmed`);
}


/* -------------------------------------------------------------- */
module.exports = { buildAirdropList, deployToken, deployAirdrop, disburseTokens };
