import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';

dotenv.config();

const app = express();
const port = 8003;

app.use(cors());
app.use(express.json());

const mongoDB = process.env.MONGODB_URI;

// MongoDB Connection
async function connectDB() {
    try {
        await mongoose.connect(mongoDB);
        console.log('MongoDB is connected');
    } catch (error) {
        console.error(`Unable to connect to the server: ${error}`);

    }
}

// Connect to MongoDB
connectDB();

// Define Mongoose Schema and Model with Validation
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        match: /^[a-zA-Z]+$/, // Allows only alphabets
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: /^\S+@\S+\.\S+$/, // Basic email validation
    },
    phone: {
        type: String,
        required: true,
        match: /^\d{10}$/, // Exactly 10 digits
    },
});
// // Create indexes
// userSchema.index({ username: 1 });
// userSchema.index({ email: 1 });
// userSchema.index({ phone: 1 });
 const User = mongoose.model('User', userSchema);

// Helper functions
const generateUsername = () => faker.internet.userName().replace(/[^a-zA-Z]/g, '');
const generatePhoneNumber = () => faker.string.numeric(10);

// Use a Set to keep track of generated emails
/*A Set is a built-in JavaScript object that stores unique values. It automatically handles duplicates*/
const usedEmails = new Set();
console.log('usedEmails', usedEmails)
const generateUniqueEmail = () => {
    let email;
    /*do { ... } while (condition);: This is a loop that repeatedly executes the block of code until the
     specified condition becomes false*/
    do {
        email = faker.internet.email();
        /*usedEmails.has(email): This checks if the generated email already exists in the usedEmails set. u
        sedEmails is presumably a Set that stores email addresses that have been previously generated
        The .has(value) method checks whether a specified value is present in the Set.*/
    } while (usedEmails.has(email));
    /*The loop continues to generate new email addresses until it finds one that is not already in the usedEmails set (i.e., a unique email address).*/
    const addEmail = usedEmails.add(email);
    console.log('addEmail',addEmail)

    return email;
};



// async function createIndexes() {
//     try {
//         console.log('Checking existing indexes...');
//         // Only create indexes if they don't exist
//         const existingIndexes = await User.collection.indexes();
//         const indexNames = existingIndexes.map(index => index.name);
        
//         if (!indexNames.includes('email_1')) {
//             console.log('Creating email index...');
//             await User.createIndex({ email: 1 }, { unique: true });
//             console.log('Index created successfully');
//         } else {
//             console.log('Index already exists');
//         }
//     } catch (error) {
//         console.error('Error creating indexes:', error);
//         throw error;
//     }
// }





// Populate Database with Random Users
async function populateDatabase(req, res) {
    try {
        console.time('populateDatabase');
        await createIndexes();

        const batchSize = 10000;  // Define batch size for performance
        const totalRecords = 5000000; // Total records to be inserted
        let recordsInserted = 0;

        /* Helper function to create a batch of users
    Array.from() is a method that creates a new array instance from an array-like or iterable object.
.map(() part of the code transforms each undefined element in the array into a user object with random data.
        Array.from({ length: batchSize/3 }): Creates an array with batchSize elements.
.map(() => (/* ... )): Transforms each element into a user object with random data.*/
        const createBatch = () => Array.from({ length: batchSize }).map(() => ({
            username: generateUsername(),
            email: generateUniqueEmail(),
            phone: generatePhoneNumber(),
        }));

        /* Generate all batches upfront
        This empty array will later be filled with arrays generated by the createBatch() function, each 
        representing a batch of users*/
        const batches = [];
        /* A for loop is used to repeatedly execute a block of code a certain number of times*/
        for (let i = 0; i < totalRecords / batchSize; i++) {
            /*generates an array of user objects, with a length equal to batchSize
            The push() method in JavaScript is used to add one or more elements to the end of an array.*/
         batches.push(createBatch());
        
        }

        // Insert all batches in parallel using Promise.all()
        await Promise.all(
            batches.map(async (users,index) => {
                try {
                    console.log(`Starting to insert batch ${index + 1} with ${users.length} users`);
                    await User.insertMany(users, { ordered: false });
                    //This means recordsInserted = 0 + 5000
                    //The second recordsInserted = 5000 + 5000
                    recordsInserted += users.length;
                    console.log(`Batch ${index + 1} inserted successfully. Total records inserted so far: ${recordsInserted}`);
                } catch (insertError) {
                    if (insertError.code === 11000) {
                        console.warn('Duplicate key error, continuing with next batch.');
                    } else {
                        throw insertError;
                    }
                }
            })
        );

        console.timeEnd('populateDatabase');
        res.status(200).json({ message: `Database populated with approximately ${recordsInserted} random users` });
    } catch (error) {
        res.status(500).json({ message: 'Error populating database', error });
    }
}








// Define route handlers
export const getUsers = async (req, res) => {
    try {
        // Get the page from the query parameters
        let page = Number(req.query.page) || 1;
        console.log('Query parameters:', req.query);

        // Determine the limit dynamically based on the page number
        let limit = getLimitForPage(page);

        // Calculate the number of documents to skip using the new function
        let skip = calculateSkipForPage(page);

        // Log the request details
        console.log(`Requesting page: ${page}, with limit: ${limit}`);
        console.log(`Skipping users: ${skip}`);

        // Fetch users with dynamic pagination
        const users = await User.find()
            .sort({ _id: 1 })  //.sort() is used to arrange the documents in a specific order based on a field
            .skip(skip)
            .limit(limit);

        console.log(`Number of users retrieved: ${users.length}`);

        // Handle no users found case
        if (users.length === 0) {
            console.warn('No users found.');
            return res.status(404).json({ message: 'No users found' });
        }

        // Respond with the fetched users
        res.status(200).json(users);

        console.log('Fetched users for page:', page, 'Skipped users:', skip);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users', error });
    }
};

// Function to determine the limit for each page dynamically
const getLimitForPage = (page) => {
    return 5000;  // 5000 records per page
};

// Function to calculate the total number of documents to skip
const calculateSkipForPage = (page) => {
    return (page - 1) * 5000;  // Skip (page - 1) * 5000 records
};




export const deleteUsers = async (req, res) => {
    const batchSize = 100; // Number of records to delete per batch

    try {
        let totalDeleted = 0;
        let deletedInCurrentBatch = 0;

        do {
            // Fetch a batch of users to delete
            const usersToDelete = await User.find({}).limit(batchSize);

            // If no more users to delete, break out of the loop
            if (usersToDelete.length === 0) {
                break;
            }
            // Delete the batch of users
            const result = await User.deleteMany({ _id: { $in: usersToDelete.map(user => user._id) } });
            deletedInCurrentBatch = result.deletedCount;
            totalDeleted += deletedInCurrentBatch;

            console.log(`Deleted ${totalDeleted} records so far`);

            // Optional: Add a delay to avoid overwhelming the server
            if (deletedInCurrentBatch > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } while (deletedInCurrentBatch === batchSize); // Continue while the batch size is met

        res.status(200).json({ message: `Deleted ${totalDeleted} users` });
    } catch (error) {
        console.error('Error deleting users:', error);
        res.status(500).send('Error deleting users');
    }
};




// Define routes directly in this file
app.post('/populate', populateDatabase);
app.get('/users', getUsers);
app.delete('/deleteAll', deleteUsers);

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});