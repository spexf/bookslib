using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options => {
    options.AddDefaultPolicy(policy => {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();
app.UseCors();

var connString = builder.Configuration.GetConnectionString("DefaultConnection");

using (var conn = new NpgsqlConnection(connString))
{
    conn.Open();
    using var cmd = new NpgsqlCommand("CREATE TABLE IF NOT EXISTS books (id SERIAL PRIMARY KEY, title TEXT, author TEXT)", conn);
    cmd.ExecuteNonQuery();
}

app.MapGet("/books", async () => {
    var books = new List<object>();
    using var conn = new NpgsqlConnection(connString);
    await conn.OpenAsync();
    using var cmd = new NpgsqlCommand("SELECT id, title, author FROM books", conn);
    using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync()) {
        books.Add(new { id = reader.GetInt32(0), title = reader.GetString(1), author = reader.GetString(2) });
    }
    return Results.Ok(books);
});

app.MapPost("/books", async (BookDto book) => {
    using var conn = new NpgsqlConnection(connString);
    await conn.OpenAsync();
    using var cmd = new NpgsqlCommand("INSERT INTO books (title, author) VALUES (@title, @author)", conn);
    cmd.Parameters.AddWithValue("title", book.title);
    cmd.Parameters.AddWithValue("author", book.author);
    await cmd.ExecuteNonQueryAsync();
    return Results.Ok();
});

app.MapDelete("/books/{id}", async (string id) => {
    using var conn = new NpgsqlConnection(connString);
    await conn.OpenAsync();
    using var cmd = new NpgsqlCommand($"DELETE FROM books WHERE id = {id}", conn);
    await cmd.ExecuteNonQueryAsync();
    return Results.Ok();
});

app.Run();

record BookDto(string title, string author);