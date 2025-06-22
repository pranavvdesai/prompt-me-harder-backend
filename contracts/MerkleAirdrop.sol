// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
  function transfer(address to, uint256 value) external returns (bool);
}

contract MerkleAirdrop {
  address  public immutable token;
  bytes32  public immutable root;
  uint256  public immutable deadline;
  mapping(address => bool) public claimed;

  constructor(address _token, bytes32 _root, uint256 _ttl) {
    token     = _token;
    root      = _root;
    deadline  = block.timestamp + _ttl;
  }

  function claim(uint256 amount, bytes32[] calldata proof) external {
    require(block.timestamp <= deadline, "expired");
    require(!claimed[msg.sender], "already");
    // leaf = keccak256(addr + amount)
    bytes32 leaf = keccak256(
      abi.encodePacked(msg.sender, amount)
    );
    require(verify(proof, leaf), "bad-proof");
    claimed[msg.sender] = true;
    require(
      IERC20(token).transfer(msg.sender, amount * 1e18),
      "transfer-fail"
    );
  }

  function verify(bytes32[] memory proof, bytes32 leaf) internal view returns (bool) {
    bytes32 hash = leaf;
    for (uint i = 0; i < proof.length; i++) {
      hash = (hash < proof[i])
        ? keccak256(abi.encodePacked(hash, proof[i]))
        : keccak256(abi.encodePacked(proof[i], hash));
    }
    return hash == root;
  }
}
