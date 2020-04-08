const { Remarkable, ItemResponse } = require('remarkable-typescript');
(async () => {
  const client = new Remarkable();
  const token = await client.register({ code: 'whahovrq' });
  console.log(token);
})()
