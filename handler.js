'use strict';

// store the standard cart item fields for later
const cart_struct = [ 
  "id",
  "type",
  "product_id",
  "name",
  "description",
  "sku",
  "image",
  "quantity",
  "manage_stock",
  "unit_price",
  "value",
  "links",
  "meta"
];

/*
getOrderItems takes a moltin client and the ID of the order, and attempts to fetch the orders items.
It returns an array containing two elements:
1. An indiciator of success (true) or failure (false), 
2. A body containing a message if failure occured, or the order items if successful.
*/
const getOrderItems = async (client, orderID) => {

  let {statusCode: ordersStatusCode, data: orderItems} = await client.get('orders/' + orderID + '/items');  

  if (!validateStatusCode(ordersStatusCode)) {
    return [false, 'bad status code while fetching order items: ' + ordersStatusCode];
  }

  if (!validateRequest(orderItems)) {
      return [false, 'no order items'];
  }

  return [true, orderItems];
}

// getCartItems follows the same format as getOrderItems
const getCartItems = async (client, cartID) => {

  let {statusCode: cartStatusCode, data: cartItems} = await client.get('carts/' + cartID + '/items');  

  if (!validateStatusCode(cartStatusCode)) {
    return [false, 'bad status code while fetching cart items: ' + cartsStatusCode]
  }

  if (!validateRequest(cartItems)) {
      return [false, 'no cart items']
  }

  return [true, cartItems]
}

// orderItemsToCartItems takes an orders items, and returns an array containing each order item ID and each associated cart item ID
const orderItemsToCartItems = (orderItems) => {
  return orderItems.map(item => {
      return {'cart': item.relationships.cart_item.data.id, 'order': item.id};
  });
};


const validateStatusCode = (code) => {
  if(code !== 200) {
    return false
  }
  return true
};

const validateRequest = (items) => {
    if(!items.length > 0) {
    return false
  }
  return true
};

/*
transferData does three things:
1. Matches an order item object with its cart item object
2. Checks what custom data is present on the cart item
3. Passes that custom data into the order item
*/
const transferData = (client, orderItems, cartItems, map) => {

  let results = [];

  map.forEach(async (mapItem, index) => {

    var orderItem = orderItems.find(function(item) {
      return item.id == mapItem.order;
    });

    var cartItem = cartItems.find(function(item) {
      return item.id == mapItem.cart;
    });

    let cartItemArr = Object.keys(cartItem);

    let filtered = cartItemArr.filter( function( el ) {
      return cart_struct.indexOf( el ) < 0;
    });

    const objectToUse = Object.keys(cartItem)
      .filter(key => filtered.includes(key))
      .reduce((obj, key) => {
        obj[key] = cartItem[key];
        return obj;
      }, {});

    let orderItemUpdated = await client.put('flows/order_items/entries/' + mapItem.order, objectToUse);

    results.push(orderItemUpdated.responseCode)      
  });

  if(!results.every(x => x === 200)) {
    return false
  }
  return true
}

const generateResponse = (code, mess) => {

  return {
    statusCode: code,
    body: JSON.stringify({
      message: mess,
    }),
  }
};

// transferFlows runs the logic gates, relying on all of the above helper functions.
module.exports.transferFlows = async (event, context) => {

  // Moltin request library setup
  const { createClient } = require('@moltin/request')

  const client = new createClient({
    client_id: process.env.MOLTIN_CLIENT_ID,
    client_secret: process.env.MOLTIN_CLIENT_SECRET
  })

  let body = JSON.parse(event.body);

  // validate the fields required to continue
  if (!('orderID' in body)) {
    return generateResponse(500, 'You have not provided orderID');
  }

  if (!('cartID' in body)) {
    return generateResponse(500, 'You have not provided cartID');
  }

  const {orderID, cartID} = body;

  try {
    let orderItems = await getOrderItems(client, orderID);

    if (!orderItems[0]) {
      return generateResponse(500, orderItems[1])
    }

    let cartItems = await getCartItems(client, cartID);

    if (!cartItems[0]) {
      return generateResponse(500, cartItems[1])
    }

    let mapped = await orderItemsToCartItems(orderItems[1]);

    let orderItemUpdateResponse = await transferData(client, orderItems[1],cartItems[1], mapped)

    if(!orderItemUpdateResponse) {
      return generateResponse(orderItemUpdateResponse.responseCode, 'error updating the order');
    }

    return generateResponse(200, 'Great success');


  } catch (error) {
    generateResponse(500, error);
  }

};