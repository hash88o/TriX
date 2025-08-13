const { ethers } = require("hardhat");

async function main() {
  // Get the first default account (has 10,000 ETH)
  const [deployer] = await ethers.getSigners();
  
  // Your wallet address (replace with your actual address)
  const yourAddress = "YOUR_WALLET_ADDRESS_HERE"; // Replace this!
  
  console.log("Sending ETH from:", deployer.address);
  console.log("To:", yourAddress);
  console.log("Deployer balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
  
  // Send 1000 ETH to your address
  const tx = await deployer.sendTransaction({
    to: yourAddress,
    value: ethers.parseEther("1000.0")
  });
  
  await tx.wait();
  console.log("✅ Sent 1000 ETH to your address!");
  console.log("Your new balance:", ethers.formatEther(await deployer.provider.getBalance(yourAddress)), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
