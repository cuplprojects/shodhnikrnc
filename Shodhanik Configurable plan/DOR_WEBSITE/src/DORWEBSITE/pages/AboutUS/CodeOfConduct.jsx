import Header from '../../components/Header';
import Footer from '../../components/Footer';

const CodeOfConduct = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        <h1 className="text-3xl font-bold text-[#0066cc] mb-6">Code of Conduct for Research</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-700 leading-relaxed">Content for Code of Conduct for Research will be added here.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};
export default CodeOfConduct;
