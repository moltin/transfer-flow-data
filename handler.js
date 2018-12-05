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

const validateRequest = items => {
    if(!items.length > 0) {
    return false
  }
  return true
};

// validateFlowFields checks that all given field names exist on the given object.
// This prevents blind updates to fields that are not there.
const validateFlowFields = (object, fields) => {
  return fields.some(el => !el in object);
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

    // grab the order item object in full
    var orderItem = orderItems.find(function(item) {
      return item.id == mapItem.order;
    });

    // grab the cart item object in full
    var cartItem = cartItems.find(function(item) {
      return item.id == mapItem.cart;
    });

    // convert the cart item to an array
    let cartItemArr = Object.keys(cartItem);

    // filter the cart item and return only the custom fields
    let customFields = cartItemArr.filter( function( el ) {
      return cart_struct.indexOf( el ) < 0;
    });

    // Returns false if any custom cart item fields do not exist on an order item
    if(!validateFlowFields(orderItem, customFields)) {
      results.push({'code': 500, 'message': 'you are updating non existant fields on order items'});
      return
    }

    // build the full object containing custom fields and values
    const objectToUse = Object.keys(cartItem)
      .filter(key => customFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = cartItem[key];
        return obj;
      }, {});

    // update the Moltin order item with the custom fields and values
    let orderItemUpdated = await client.put('flows/order_items/entries/' + mapItem.order, objectToUse);

    results.push({'code': orderItemUpdated.responseCode, 'message': null})      
  });

  if(!results.every(x => x.code === 200)) {
    return [false, null]
  }

  return [true, null]
};

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


    if(!orderItemUpdateResponse[0]) {
      return generateResponse(500, orderItemUpdateResponse[1]);
    }

    return generateResponse(200, 'Great success');

  } catch (error) {
    generateResponse(500, error);
  }

};