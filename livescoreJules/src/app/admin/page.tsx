<div className="flex flex-wrap gap-4 justify-center mt-4">
  {/* Increment buttons */}
  <button
    onClick={() => updateScore('home')}
    className="p-2 bg-blue-500 text-white rounded"
  >
    +1 Home Goal
  </button>
  <button
    onClick={() => updateScore('away')}
    className="p-2 bg-blue-500 text-white rounded"
  >
    +1 Away Goal
  </button>
  {/* Decrement buttons */}
  <button
    onClick={() => decrementScore('home')}
    className="p-2 bg-purple-500 text-white rounded"
  >
    -1 Home Goal
  </button>
  <button
    onClick={() => decrementScore('away')}
    className="p-2 bg-purple-500 text-white rounded"
  >
    -1 Away Goal
  </button>
  {/* Status buttons */}
  <button
    onClick={() => updateStatus('live')}
    className="p-2 bg-yellow-500 text-white rounded"
  >
    Live
  </button>
  <button
    onClick={() => updateStatus('halftime')}
    className="p-2 bg-orange-500 text-white rounded"
  >
    Halftime
  </button>
  <button
    onClick={() => updateStatus('final')}
    className="p-2 bg-red-500 text-white rounded"
  >
    Final
  </button>
  {/* Reset button */}
  <button
    onClick={resetMatch}
    className="p-2 bg-gray-600 text-white rounded"
  >
    Reset
  </button>
</div>
