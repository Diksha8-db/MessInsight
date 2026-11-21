import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from './logger';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  // If Mongoose is already connected (e.g. In test suites using MongoMemoryServer or active sessions),
  // return the active connection to avoid openUri() conflict errors.
  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  // If currently connecting, wait for the connection to settle
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    cached.conn = mongoose;
    return mongoose;
  }

  // If connection was disconnected, reset stale cache
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = env.MONGODB_URI;

    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: process.env.NODE_ENV !== 'production',
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((m) => {
        logger.info('[Database] MongoDB connection established successfully');
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        logger.error('[Database] MongoDB connection failed', undefined, undefined, err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}

export const connectDb = connectToDatabase;

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  cached.conn = null;
  cached.promise = null;
  logger.info('[Database] Disconnected from MongoDB');
}

