/**
 * Dedicated Read-Only Client for ZOOSH Quotation System
 * Connects securely to the separate Supabase project on-demand.
 * 
 * Rules:
 * - Read-only SELECT operations only.
 * - No background listeners or automatic synchronization.
 * - No mutation or modification of original quotation records.
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Services = window.Zoosh.Services || {};

window.Zoosh.Services.QuotationClient = {
  _client: null,

  getClient() {
    if (this._client) return this._client;

    if (!window.supabase) {
      throw new Error('Supabase JS library is not loaded.');
    }

    const config = window.Zoosh.Config;
    const url = config.QUOTATION_SUPABASE_URL;
    const key = config.QUOTATION_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Quotation Supabase credentials are not configured in js/config.js');
    }

    this._client = window.supabase.createClient(url, key);
    return this._client;
  },

  /**
   * Calculates financial breakdown for a quotation record
   * matching the Quotation System's native pricing engine.
   */
  calculateTotals(quote) {
    let subtotal = 0;
    const items = quote.items || [];
    const itemData = quote.itemData || {};

    items.forEach((itemId) => {
      const item = itemData[itemId] || {};
      const unit = parseFloat(item.unit) || 0;
      const qty = parseInt(item.qty, 10) || 1;
      subtotal += unit * qty;
    });

    const taxPricing = quote.taxPricing || {};
    const disc = parseFloat(taxPricing.disc) || 0;
    const discAmount = (subtotal * disc) / 100;
    const afterDisc = subtotal - discAmount;

    const isGstRemoved = Boolean(taxPricing.removeGst) || 
      (taxPricing.gst !== undefined && taxPricing.gst !== '' && parseFloat(taxPricing.gst) === 0);
    const gstPercent = isGstRemoved ? 0 : (parseFloat(taxPricing.gst) || 0);
    const gstAmount = (afterDisc * gstPercent) / 100;
    const grandTotal = Math.round(afterDisc + gstAmount);

    return {
      subtotal,
      discountPercent: disc,
      discountAmount: discAmount,
      afterDiscount: afterDisc,
      gstPercent,
      gstAmount,
      grandTotal,
      itemCount: items.length
    };
  },

  /**
   * Normalizes client details across different quotation revisions
   */
  normalizeClient(clientObj) {
    if (!clientObj || typeof clientObj !== 'object') {
      return { name: 'Unknown Client', phone: '', location: '', email: '', gst: '' };
    }
    return {
      name: (clientObj.name || '').trim() || 'Unnamed Client',
      phone: (clientObj.phone || '').trim(),
      location: (clientObj.addr || clientObj.address || clientObj.city || '').trim(),
      email: (clientObj.email || '').trim(),
      gst: (clientObj.gst || '').trim(),
      company: (clientObj.co || '').trim()
    };
  },

  /**
   * Fetch all quotations on-demand
   */
  async fetchQuotations() {
    const supabaseClient = this.getClient();

    const { data, error } = await supabaseClient
      .from('quotations')
      .select('id, no, sequenceNumber, revision, date, valid, curr, client, company, items, itemData, taxPricing, terms, status, history, createdAt, updatedAt');

    if (error) {
      console.error('Failed to fetch quotations from separate Supabase project:', error);
      throw error;
    }

    const quotes = (data || []).map((q) => {
      const totals = this.calculateTotals(q);
      const clientNorm = this.normalizeClient(q.client);
      return {
        ...q,
        totals,
        clientNormalized: clientNorm
      };
    });

    // Sort using the Quotation System's native ordering: newest updated/created first
    quotes.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || b.date || 0).getTime();
      return timeB - timeA;
    });

    return quotes;
  },

  /**
   * Fetch a single full quotation by ID (including itemPhotos if available)
   */
  async fetchQuotationById(id) {
    const supabaseClient = this.getClient();

    const { data, error } = await supabaseClient
      .from('quotations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch quotation ${id}:`, error);
      throw error;
    }

    if (!data) return null;

    const totals = this.calculateTotals(data);
    const clientNorm = this.normalizeClient(data.client);

    return {
      ...data,
      totals,
      clientNormalized: clientNorm
    };
  }
};
