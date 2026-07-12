const resolveGatewayPort = ({ env = process.env, configPort } = {}) => {
  const rawPort = env.GATEWAY_PORT || env.PORT || configPort;

  if (rawPort === undefined || rawPort === null || rawPort === '') {
    throw new Error('Gateway port must be configured via GATEWAY_PORT, PORT, or config.port');
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Gateway port must be a valid TCP port');
  }

  return port;
};

module.exports = {
  resolveGatewayPort
};
