// frontend/src/components/StatCard.tsx
export function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md text-center border border-gray-200">
      <p className="text-4xl font-bold text-gray-800">{value}</p>
      <p className="text-gray-500 mt-2 font-medium">{label}</p>
    </div>
  );
}