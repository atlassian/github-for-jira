import { useState } from 'react';
import Button from '@atlaskit/button';

const App = () => {
  const [count, setCount] = useState(0);

	return (
    <>
			<h1>SPA</h1>
			<Button onClick={() => setCount((count) => count + 1)}>
				count is {count}
			</Button>
    </>
  );
};

export default App;
