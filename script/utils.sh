is_installed () {
  which $@ >/dev/null
}

echo_red () {
  echo -e "\033[1;31m${@}\033[0m"
}

echo_bold () {
  echo -e "\033[3;34m${@}\033[0m"
}
