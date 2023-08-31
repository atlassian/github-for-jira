set -e #exit on failed commands

cd spa

# Doing yarn install to avoid any build errors
yarn

yarn build

echo "All done!!"
