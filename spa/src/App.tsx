import { useState } from "react";
import Button from "@atlaskit/button";

/**
 * This is just for testing
 * TODO: Remove this dummy component and add the actual ones
 */
const App = () => {
  const [count, setCount] = useState(0);

	return (
    <>
			<h1>SPA</h1>
			<p>count is {count}</p>
			<Button onClick={() => setCount((count) => count + 1)}>Click</Button>
    </>
  );
};

export default App;
