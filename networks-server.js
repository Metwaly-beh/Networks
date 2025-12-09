const express = require('express');
const session = require('express-session');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = 8080;


const url = 'mongodb://localhost:27017';
const dbName = 'myDB';
const collectionName = 'myCollection';

let db;
let usersCollection;


MongoClient.connect(url)
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    usersCollection = db.collection(collectionName);
  })
  .catch(error => console.error('MongoDB connection error:', error));
  app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: 'travelling-website-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));



app.get('/register', (req, res) => {
  res.render('registration', { error: null, success: null });
});


app.post('/register', async (req, res) => {
 
    const { username, password } = req.body;

    if (!username || !password || username.trim() === '' || password.trim() === '') {
      return res.render('registration', { 
        error: 'Username and password cannot be empty', 
        success: null 
      });
    }


    const existingUser = await usersCollection.findOne({ username: username });
    
    if (existingUser) {
      return res.render('registration', { 
        error: 'Username already in DB', 
        success: null 
      });
    }


    await usersCollection.insertOne({
      username: username,
      password: password,
      wantToGoList: []
    });

    console.log('User registered successfully:', username);


    res.redirect('/login?registered=true');

 
});


app.get('/login', (req, res) => {
  const registered = req.query.registered === 'true';
  res.render('login', { 
    error: null, 
    success: registered ? 'Registration successful! Please login.' : null 
  });
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await usersCollection.findOne({ username: username, password: password });

    if (!user) {
      return res.render('login', { 
        error: 'Invalid username or password', 
        success: null 
      });
    }

    req.session.userId = user._id;
    req.session.username = user.username;
    res.redirect('/home');

  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { 
      error: 'An error occurred during login', 
      success: null 
    });
  }
});

app.get('/destination/:name', async (req, res) => {
  
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const destinationName = req.params.name;

  
  const destinations = {
    'paris': {
      name: 'Paris',
      country: 'France',
      description: 'The City of Light is known for the Eiffel Tower, world-class museums like the Louvre, romantic streets, and amazing French cuisine. Best time to visit: April to June or September to November.',
      videoUrl: 'https://www.youtube.com/embed/AQ6GmpMu5L8'  // Paris travel video
    },
    'maldives': {
      name: 'Maldives',
      country: 'Indian Ocean',
      description: 'A tropical paradise with crystal-clear waters, white sandy beaches, and luxurious overwater bungalows. Perfect for diving, snorkeling, and relaxation. Best time to visit: November to April.',
      videoUrl: 'https://www.youtube.com/embed/RScekDK5bPM'  // Maldives travel video
    },
    'tokyo': {
      name: 'Tokyo',
      country: 'Japan',
      description: 'A vibrant blend of traditional culture and modern technology. Experience ancient temples, incredible food, cherry blossoms, and cutting-edge technology. Best time to visit: March to May or September to November.',
      videoUrl: 'https://www.youtube.com/embed/DqE4eJanJv4'  // Tokyo travel video
    },
    'swiss-alps': {
      name: 'Swiss Alps',
      country: 'Switzerland',
      description: 'Majestic mountain peaks, pristine lakes, charming villages, and world-class skiing. Experience breathtaking scenery, hiking trails, and Swiss chocolate. Best time to visit: December to March for skiing, June to September for hiking.',
      videoUrl: 'https://www.youtube.com/embed/vRVUCOw4rRQ'  // Swiss Alps video
    },

      'italy': {
      name: 'Italy',
      country: 'Italy',
      description: 'Pizza.',
      videoUrl: 'https://www.youtube.com/embed/h656vyNvAko'// Amr sherif Pizza video
    }
    
  };

  const destination = destinations[destinationName.toLowerCase()];

  if (!destination) {
    return res.send('Destination not found');
  }


    const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
    const alreadyInList = user.wantToGoList && user.wantToGoList.includes(destination.name);

  res.render('destination', { 
    destination: destination,
    error: null,
    success: null,
    alreadyInList: alreadyInList,
    username: req.session.username
  });
});
app.get('/want-to-go-list', async (req, res) => {

  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
   
    const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });


    
    const wantToGoList = user.wantToGoList || [];

    res.render('want-to-go-list', {
      username: req.session.username,
      destinations: wantToGoList
    });

  } catch (error) {
    console.error('Error loading want-to-go list:', error);
    res.send('An error occurred while loading your list');
  }
});


app.post('/add-to-list', async (req, res) => {

  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    const { destinationName } = req.body;


    const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });



    if (user.wantToGoList && user.wantToGoList.includes(destinationName)) {

      return res.redirect(`/destination/${destinationName.toLowerCase().replace(' ', '-')}?error=already`);
    }


    await usersCollection.updateOne(
      { _id: req.session.userId },
      { $push: { wantToGoList: destinationName } }
    );

    console.log(`Added ${destinationName} to ${user.username}'s want-to-go list`);


    res.redirect(`/destination/${destinationName.toLowerCase().replace(' ', '-')}?success=added`);

  } catch (error) {
    console.error('Error adding to want-to-go list:', error);
    res.send('An error occurred');
  }
});


app.get('/destination/:name', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const destinationName = req.params.name;

  const destinations = {
    'paris': {
      name: 'Paris',
      country: 'France',
      description: 'The City of Light is known for the Eiffel Tower, world-class museums like the Louvre, romantic streets, and amazing French cuisine. Best time to visit: April to June or September to November.',
      videoUrl: 'https://www.youtube.com/embed/AQ6GmpMu5L8'
    },
    'maldives': {
      name: 'Maldives',
      country: 'Indian Ocean',
      description: 'A tropical paradise with crystal-clear waters, white sandy beaches, and luxurious overwater bungalows. Perfect for diving, snorkeling, and relaxation. Best time to visit: November to April.',
      videoUrl: 'https://www.youtube.com/embed/RScekDK5bPM'
    },
    'tokyo': {
      name: 'Tokyo',
      country: 'Japan',
      description: 'A vibrant blend of traditional culture and modern technology. Experience ancient temples, incredible food, cherry blossoms, and cutting-edge technology. Best time to visit: March to May or September to November.',
      videoUrl: 'https://www.youtube.com/embed/DqE4eJanJv4'
    },
    'swiss-alps': {
      name: 'Swiss Alps',
      country: 'Switzerland',
      description: 'Majestic mountain peaks, pristine lakes, charming villages, and world-class skiing. Experience breathtaking scenery, hiking trails, and Swiss chocolate. Best time to visit: December to March for skiing, June to September for hiking.',
      videoUrl: 'https://www.youtube.com/embed/vRVUCOw4rRQ'
    },
    'italy': {
      name: 'Italy',
      country: 'Italy',
      description: 'Pizza.',
      videoUrl: 'https://www.youtube.com/embed/h656vyNvAko'
    }




  };

  const destination = destinations[destinationName.toLowerCase()];

  if (!destination) {
    return res.send('Destination not found');
  }

  const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });

  const alreadyInList = user.wantToGoList && user.wantToGoList.includes(destination.name);


  let errorMessage = null;
  let successMessage = null;

  if (req.query.error === 'already') {
    errorMessage = 'This destination is already in your want-to-go list!';
  }
  if (req.query.success === 'added') {
    successMessage = 'Successfully added to your want-to-go list!';
  }

  res.render('destination', { 
    destination: destination,
    error: errorMessage,
    success: successMessage,
    alreadyInList: alreadyInList,
    username: req.session.username
  });
});



app.get('/home', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.render('home', { username: req.session.username });
});



app.get('/', (req, res) => {
  res.redirect('/login');
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Go to http://localhost:8080/register to test registration');
});
