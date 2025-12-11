export default function TeacherMaterials() {
  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 w-full max-w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4">Materiały</h1>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-2">Lista materiałów</h2>
        <p className="text-gray-600 text-sm sm:text-base">(Tutaj pojawi się lista materiałów edukacyjnych.)</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-2">Dodaj materiał</h2>
        <form className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tytuł materiału</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-colors duration-200" 
              required 
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Opis</label>
            <textarea 
              className="w-full border border-gray-300 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#4067EC] focus:border-[#4067EC] transition-colors duration-200" 
              rows={3} 
              required 
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-[#4067EC] text-white py-1.5 sm:py-2 rounded-lg hover:bg-[#3155d4] transition-colors duration-200 text-sm sm:text-base font-semibold"
          >
            Dodaj materiał
          </button>
        </form>
      </div>
    </div>
  );
} 