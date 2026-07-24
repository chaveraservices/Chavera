import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { PRODUCT_OPTIONS } from './contactFields';

// Loads the product catalogue from the database. Falls back to the built-in
// list only if the request fails or returns nothing, so the form is never left
// with an empty product picker even offline or on a fresh DB.
//
// Returns:
//   products    — array of product-name strings
//   loaded      — true once the initial fetch has settled
//   addProduct  — async (name) => { ok, name?, error? } (admin only; the API
//                 gates creation, a staff call returns { ok:false })
export default function useProducts() {
  const [products, setProducts] = useState(PRODUCT_OPTIONS);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.post('/product/list');
      const names = (res.data?.data || []).map(p => p.name).filter(Boolean);
      if (names.length) setProducts(names);
    } catch {
      /* keep the fallback list */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().finally(() => { if (cancelled) setLoaded(false); });
    return () => { cancelled = true; };
  }, [load]);

  const addProduct = useCallback(async (rawName) => {
    const name = (rawName || '').trim();
    if (!name) return { ok: false, error: 'Enter a product name.' };
    try {
      const res = await api.post('/product/create', { name });
      // Server returns the canonical name (and reactivates a soft-deleted one).
      const created = res.data?.data?.name || name;
      setProducts(prev => (prev.includes(created) ? prev : [...prev, created]));
      return { ok: true, name: created };
    } catch (err) {
      return { ok: false, error: err.response?.data?.message || 'Could not add the product.' };
    }
  }, []);

  return { products, loaded, addProduct, reload: load };
}
