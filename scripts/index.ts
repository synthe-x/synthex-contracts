import deploy from './deploy';

export default async function main(logs: boolean = true, test: boolean = false) {
  deploy(logs, test);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});