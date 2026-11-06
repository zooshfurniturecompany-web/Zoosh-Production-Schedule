/**
 * Guided 4-Step Add Item Wizard Modal (Legacy Alias)
 * Forwards all calls to window.Zoosh.AddFurnitureWizard
 */
window.Zoosh = window.Zoosh || {};

if (window.Zoosh.AddFurnitureWizard) {
  window.Zoosh.AddSrlWizard = window.Zoosh.AddFurnitureWizard;
} else {
  // Alias defined upon script initialization
  window.addEventListener('DOMContentLoaded', () => {
    if (window.Zoosh.AddFurnitureWizard) {
      window.Zoosh.AddSrlWizard = window.Zoosh.AddFurnitureWizard;
    }
  });
}
