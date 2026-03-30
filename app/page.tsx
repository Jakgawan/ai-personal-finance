export default function Dashboard(){
  return (
 <main className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
     <div className="bg-white rounded-lg p-6 shadow">
      <p className="text-sm text-gray-500">Total</p>
      <p className="text-3xl font-bold">฿ 0</p>
     </div>
     <div className="grid grid-cols-2 gap-4 mt-4">
      <div className="bg-white rounded-lg p-6 shadow">
        <p className="text-sm text-gray-500">Income</p>
        <p className="text-3xl font-bold">฿ 0</p>
      </div>
      <div className="bg-white rounded-lg p-6 shadow">
        <p className="text-sm text-gray-500">Expense</p>
        <p className="text-3xl font-bold">฿ 0</p>
      </div>
     </div>
  </main>
  )
}