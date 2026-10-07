const SimpleEducationalDetails = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: 'white', minHeight: '400px' }}>
      <h1 style={{ color: 'red', fontSize: '24px', marginBottom: '20px' }}>
        SIMPLE EDUCATIONAL DETAILS PAGE
      </h1>
      <p style={{ color: 'black', fontSize: '16px' }}>
        This is a simplified version to test if the routing and rendering works.
      </p>
      <div style={{ backgroundColor: 'lightblue', padding: '10px', margin: '10px 0' }}>
        <p>If you can see this blue box, the component is rendering correctly.</p>
      </div>
    </div>
  );
};

export default SimpleEducationalDetails;