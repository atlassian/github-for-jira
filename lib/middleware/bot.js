module.exports = async (context) => {
  if (context.payload.sender.type === 'Bot') {
    return
  }

  return context
}
