"use client";

import { useState, useEffect } from "react";
import { insertFoodLogs } from "@/lib/supabase/nutrition";
import type { FoodSearchResult } from "@/lib/fuel/food";

interface BarcodeScannerProps {
  mealType: "breakfast" | "lunch" | "dinner" | "snacks";
  onScanComplete: () => void;
  onCancel: () => void;
}

/**
 * Mock barcode scanner component. In a real implementation, this would
 * use react-native-camera or expo-barcode-scanner. For web, we simulate
 * scanning with sample barcodes.
 */
export default function BarcodeScanner({
  mealType,
  onScanComplete,
  onCancel,
}: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scannedFood, setScannedFood] = useState<FoodSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sample barcodes for testing (common Indian foods)
  const SAMPLE_BARCODES: Record<string, FoodSearchResult> = {
    "8901030061011": {
      id: "sample:1",
      name: "Amul Milk",
      brand: "Amul",
      food_group: "Dairy",
      source: "sample",
      badge: "Sample",
      badgeColor: "text-muted",
      canEdit: false,
      per100g: { calories: 62, protein_g: 3.2, fat_g: 3.3, carbs_g: 4.8, fiber_g: 0 },
    },
    "8901030061028": {
      id: "sample:2",
      name: "Amul Butter",
      brand: "Amul",
      food_group: "Dairy",
      source: "sample",
      badge: "Sample",
      badgeColor: "text-muted",
      canEdit: false,
      per100g: { calories: 720, protein_g: 0.9, fat_g: 81.0, carbs_g: 0.1, fiber_g: 0 },
    },
    "8901123456789": {
      id: "sample:3",
      name: "Tata Salt",
      brand: "Tata",
      food_group: "Condiments",
      source: "sample",
      badge: "Sample",
      badgeColor: "text-muted",
      canEdit: false,
      per100g: { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 },
    },
    "8901234567890": {
      id: "sample:4",
      name: "Maggi Noodles",
      brand: "Maggi",
      food_group: "Packaged",
      source: "sample",
      badge: "Sample",
      badgeColor: "text-muted",
      canEdit: false,
      per100g: { calories: 345, protein_g: 8.1, fat_g: 14.5, carbs_g: 44.9, fiber_g: 2.1 },
    },
  };

  useEffect(() => {
    if (isScanning) {
      // Simulate scanning with a random delay
      const scanTimer = setTimeout(() => {
        // Pick a random sample barcode for demo
        const sampleCodes = Object.keys(SAMPLE_BARCODES);
        const randomCode =
          sampleCodes[Math.floor(Math.random() * sampleCodes.length)];
        setScannedCode(randomCode);
        setScannedFood(SAMPLE_BARCODES[randomCode]);
        setIsScanning(false);
      }, 1500 + Math.random() * 1500); // 1.5-3 second scan time

      return () => clearTimeout(scanTimer);
    }
  }, [isScanning]);

  const rescan = () => {
    setScannedCode(null);
    setScannedFood(null);
    setIsScanning(true);
  };

  const logScannedFood = async () => {
    if (!scannedFood || loading) return;

    setLoading(true);
    setError(null);

    try {
      // Log the scanned food
      const g = 100; // default serving
      await insertFoodLogs([
        {
          logged_date: new Date().toISOString().split("T")[0],
          meal_type: mealType,
          food_source: "barcode",
          food_ref_id: scannedFood.id,
          food_name: scannedFood.name,
          brand: scannedFood.brand,
          serving_amount: 1,
          serving_unit: "100g",
          serving_g: g,
          calories: Math.round(scannedFood.per100g.calories),
          protein_g: Math.round(scannedFood.per100g.protein_g * 10) / 10,
          fat_g: Math.round(scannedFood.per100g.fat_g * 10) / 10,
          carbs_g: Math.round(scannedFood.per100g.carbs_g * 10) / 10,
          fiber_g: Math.round(scannedFood.per100g.fiber_g * 10) / 10,
        },
      ]);
      onScanComplete();
    } catch (err) {
      setError("Couldn't log scanned food. Try again.");
      setLoading(false);
    }
  };

  if (!isScanning && !scannedFood) {
    // This shouldn't happen, but just in case
    setIsScanning(true);
    return null;
  }

  return (
    <div className="barcode-scanner-modal">
      <div className="scanner-container">
        {/* Scanner header */}
        <div className="scanner-header flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Barcode Scanner</h2>
          <button
            className="p-1"
            onClick={onCancel}
            aria-label="Cancel"
          >
            ×
          </button>
        </div>

        {/* Scanner viewfinder */}
        <div className="scanner-viewfinder flex-1 relative">
          {isScanning ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="scanner-overlay">
                <div className="scanner-border">
                  <div className="corner top-left"></div>
                  <div className="corner top-right"></div>
                  <div className="corner bottom-left"></div>
                  <div className="corner bottom-right"></div>
                </div>
                <div className="scanner-lines animate-bounce">
                  <div className="line"></div>
                  <div className="line"></div>
                  <div className="line"></div>
                </div>
                <p className="mt-4 text-center text-sm text-muted">
                  Point camera at barcode<br />
                  <span className="font-medium">Scanning…</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-dashed border-white rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3"/>
                  </svg>
                </div>
                <p className="text-lg text-white font-medium">
                  {scannedFood?.name || "Scanned Item"}
                </p>
                <p className="text-sm text-white/80">
                  Barcode: {scannedCode || "———"}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={rescan}
                    className="px-4 py-2 border border-white rounded-full text-sm hover:bg-white/10 transition-colors"
                  >
                    Rescan
                  </button>
                  <button
                    onClick={logScannedFood}
                    disabled={loading}
                    className="btn-primary px-4 py-2 rounded-full"
                  >
                    {loading ? "Logging…" : "Log Item"}
                  </button>
                </div>
                {error && (
                  <p className="text-sm text-red mt-2">{error}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scanner footer with tips */}
        <div className="scanner-footer p-4 border-t">
          <p className="text-[0.7rem] text-muted text-center">
            Make sure the barcode is within the frame and well-lit
          </p>
          <p className="text-[0.65rem] text-muted text-center mt-1">
            Works with UPC, EAN, and QR codes
          </p>
        </div>
      </div>
    </div>
  );
}