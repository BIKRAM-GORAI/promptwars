/**
 * Client state manager for Cart and User Roles.
 */
class StateManager {
  getCart() {
    try {
      const cart = localStorage.getItem('cart');
      return cart ? JSON.parse(cart) : [];
    } catch (e) {
      return [];
    }
  }

  saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    // Trigger custom event to update header indicator if active
    window.dispatchEvent(new Event('cart-updated'));
  }

  addToCart(product, quantity = 1) {
    const cart = this.getCart();
    const existing = cart.find(item => item.productId === product._id);
    
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.image
      });
    }
    
    this.saveCart(cart);
    console.log(`[STATE] Added product to cart: ${product.name}`);
  }

  removeFromCart(productId) {
    let cart = this.getCart();
    cart = cart.filter(item => item.productId !== productId);
    this.saveCart(cart);
  }

  clearCart() {
    localStorage.removeItem('cart');
    window.dispatchEvent(new Event('cart-updated'));
  }

  getCartTotal() {
    const cart = this.getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  getCartCount() {
    const cart = this.getCart();
    return cart.reduce((count, item) => count + item.quantity, 0);
  }

  isAdminLoggedIn() {
    return !!localStorage.getItem('adminToken');
  }

  logoutAdmin() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminName');
  }
}

export const state = new StateManager();
export default state;
