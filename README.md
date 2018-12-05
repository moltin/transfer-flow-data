This repository contains a single serverless function with accepts an order ID and a cart ID.

When run, it will attempt to transfer any custom flow data from each cart item onto their associated order item.

If you would like to deploy this function, you must do a couple of things:
1. Create a flow called 'cart_items'
2. Create a flow called 'order_items'
3. Create the flow fields you need on the cart_items flow
4. Create exactly the same flow fields on the order_items flow

* Note: you cannot associate one field with multiple flows. You must create the same field again.