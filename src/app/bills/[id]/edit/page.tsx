'use client';

import { useParams } from 'next/navigation';

export default function EditBillPage() {
  const params = useParams<{ id?: string }>();
  const billId = params?.id;

  if (!billId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Bill not found</h1>
          <p className="mt-2 text-gray-600">The requested bill identifier is missing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Edit Bill</h1>
        <p className="mt-2 text-gray-600">Bill editing is currently unavailable for bill #{billId}.</p>
      </div>
    </div>
  );
}
