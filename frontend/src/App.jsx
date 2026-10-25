import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ItemModal from './components/ItemModal';
import OutcomeModal from './components/OutcomeModal';
import Toast from './components/Toast';

import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import UseFirst from './pages/UseFirst';
import ShoppingList from './pages/ShoppingList';
import Outcomes from './pages/Outcomes';
import WasteToWealthDashboard from './components/WasteToWealthDashboard';

import { api } from './api';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(Date.now());

  // Modal states
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [itemForOutcome, setItemForOutcome] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchStats = async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
    } catch (err) {
      console.error('Failed to update stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger(Date.now());
  };

  const handleOpenAddItem = (initialData = null) => {
    setItemToEdit(initialData && typeof initialData === 'object' ? initialData : null);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item) => {
    setItemToEdit(item);
    setIsItemModalOpen(true);
  };

  const handleOpenOutcome = (item) => {
    setItemForOutcome(item);
    setIsOutcomeModalOpen(true);
  };

  const handleSaveItem = async (payload, itemId) => {
    if (itemId) {
      await api.updateItem(itemId, payload);
      showToast(`Updated "${payload.name}" successfully.`, 'success');
    } else {
      await api.createItem(payload);
      showToast(`Added "${payload.name}" to inventory.`, 'success');
    }
    triggerRefresh();
  };

  const handleOutcomeSuccess = (res) => {
    showToast(`Recorded ${res.quantity} ${res.unit} of "${res.item_name}" as ${res.outcome_type.toUpperCase()}.`, 'success');
    triggerRefresh();
  };

  return (
    <div className="min-h-screen bg-[#111620] text-[#F3E8D0] flex flex-col selection:bg-[#D8B56D]/30 selection:text-[#F3E8D0]">
      {/* Top Navigation */}
      <Navbar
        onOpenAddItem={handleOpenAddItem}
        hasSampleData={stats?.has_sample_data}
        onDataChange={triggerRefresh}
        showToast={showToast}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setTab={setCurrentTab}
          stats={stats}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="max-w-6xl mx-auto pb-12">
            {(currentTab === 'dashboard' || currentTab === 'receipt') && (
              <Dashboard
                setTab={setCurrentTab}
                onOpenAddItem={handleOpenAddItem}
                onOpenOutcome={handleOpenOutcome}
                onDataRefresh={refreshTrigger}
                showToast={showToast}
              />
            )}

            {currentTab === 'waste-to-wealth' && (
              <WasteToWealthDashboard
                setTab={setCurrentTab}
                onDataRefresh={refreshTrigger}
                showToast={showToast}
              />
            )}

            {currentTab === 'inventory' && (
              <Inventory
                onOpenAddItem={handleOpenAddItem}
                onEditItem={handleEditItem}
                onOpenOutcome={handleOpenOutcome}
                showToast={showToast}
                refreshTrigger={refreshTrigger}
              />
            )}

            {currentTab === 'use-first' && (
              <UseFirst
                onOpenOutcome={handleOpenOutcome}
                onEditItem={handleEditItem}
                showToast={showToast}
                refreshTrigger={refreshTrigger}
              />
            )}

            {currentTab === 'shopping-list' && (
              <ShoppingList
                showToast={showToast}
                onDataRefresh={refreshTrigger}
              />
            )}

            {currentTab === 'outcomes' && (
              <Outcomes
                showToast={showToast}
                refreshTrigger={refreshTrigger}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals and Toasts */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        onSave={handleSaveItem}
        itemToEdit={itemToEdit}
      />

      <OutcomeModal
        isOpen={isOutcomeModalOpen}
        onClose={() => setIsOutcomeModalOpen(false)}
        item={itemForOutcome}
        onSuccess={handleOutcomeSuccess}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
