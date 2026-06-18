export const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(7)].map((_, i) => (
      <td key={i} className="px-5 py-4">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

export const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 animate-pulse">
    <div className="rounded-xl p-3 bg-gray-100 w-12 h-12" />
    <div className="space-y-2">
      <div className="h-5 bg-gray-100 rounded w-16" />
      <div className="h-3 bg-gray-100 rounded w-24" />
    </div>
  </div>
);
