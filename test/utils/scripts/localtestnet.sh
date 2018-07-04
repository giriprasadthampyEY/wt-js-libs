#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
  # Kill the npm instance that we started (if we started one and if it's still running).
  if [ -n "$npm_pid" ] && ps -p $npm_pid > /dev/null; then
    kill -9 $npm_pid
  fi  
}

ganache_port=8545

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
  local accounts=(
    # We define 5 accounts with balance lots of ether, needed for high-value tests.
    # Available Accounts - on a clean network
    # =======================================
    # (0) 0x87265a62c60247f862b9149423061b36b460f4bb
    # (1) 0xb99c958777f024bc4ce992b2a0efb2f1f50a4dcf
    # (2) 0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906
    # (3) 0x04e46f24307e4961157b986a0b653a0d88f9dbd6
    # (4) 0x380586d71798eefe6bdca55774a23b9701ce3ec9
    # 
    --account="0xe8280389ca1303a2712a874707fdd5d8ae0437fab9918f845d26fd9919af5a92,10000000000000000000000000000000000000000000000000000000000000000000000000000000"
    --account="0xed095a912033d26dc444d2675b33414f0561af170d58c33f394db8812c87a764,10000000000000000000000000000000000000000000000000000000000000000000000000000000"
    --account="0xf5556ca108835f04cd7d29b4ac66f139dc12b61396b147674631ce25e6e80b9b,10000000000000000000000000000000000000000000000000000000000000000000000000000000"
    --account="0xd1bea55dd05b35be047e409617bc6010b0363f22893b871ceef2adf8e97b9eb9,10000000000000000000000000000000000000000000000000000000000000000000000000000000"
    --account="0xfc452929dc8ffd956ebab936ed0f56d71a8c537b0393ea9da4807836942045c5,10000000000000000000000000000000000000000000000000000000000000000000000000000000"
  )

  node_modules/.bin/ganache-cli  --gasLimit 0xfffffffffff "${accounts[@]}" > /dev/null &
  ganache_pid=$!
}

if ganache_running; then
  echo "Using existing ganache instance"
else
  echo "Starting our own ganache instance"
  start_ganache
fi

# migrate contracts
./node_modules/.bin/truffle migrate --network development
# Fire up the application
npm run test-runner &
npm_pid=$!
# And let ganache running
wait $npm_pid
